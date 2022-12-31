/**
 *   Echo Search
 *
 *   An algorithm to search and replace strings in files recursively
 *
 *   author: Cyrus Mobini
 *
 *   Licensed under the MIT license.
 *   http://www.opensource.org/licenses/mit-license.php
 *
 *   Copyright 2023 Cyrus Mobini (https://github.com/cyrus2281)
 *
 *
 */
const fs = require("fs");
const path = require("path");

/**
 * Search Query parameter
 * @typedef {Object} QueryParam
 * @property {string|RegExp} searchQuery the search query (string or regex)
 * @property {string} replaceQuery the replacement string
 * @property {string[]} regexFlags regular expression modifier flags
 * @property {boolean} isRegex whether the search query is a regex or not
 * @property {boolean} matchWhole whether the search query should match the whole word or not
 */

/**
 * EchoSearch search parameter
 * @typedef {Object} EchoSearchParam
 * @property {QueryParam} query the search query
 * @property {string[]} directories the directories to search in
 * @property {string[]} fileTypes the file types to search for. Empty array for all files
 * @property {string[]} excludes the directories/files to exclude. Empty array for no exclusion
 */

/**
 * get all files in a directory and subdirectories
 * @param {string} directory the directory to crawl in
 * @param {string[]} fileTypes the file types to search for. Empty array for all files
 * @param {string[]} excludes the directories/files to exclude. Empty array for no exclusion
 * @returns {string[]} files sub-files in the directory
 */
const crawlDirectory = async (directory, fileTypes = [], excludes = []) => {
  const files = [];
  const items = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      if (!excludes.some((exc) => item.name.includes(exc))) {
        const nestedFiles = await crawlDirectory(
          path.join(directory, item.name),
          fileTypes,
          excludes
        );
        files.push(...nestedFiles);
      }
    } else {
      if (!excludes.some((exc) => item.name.includes(exc))) {
        if (fileTypes.length > 0) {
          if (fileTypes.includes(item.name.split(".").pop())) {
            files.push(path.join(directory, item.name));
          }
        } else {
          files.push(path.join(directory, item.name));
        }
      }
    }
  }
  return files;
};

const escapeSearchQuery = (searchQuery) => {
  return searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
};

/**
 * replace a string in a given text value
 * @param {string} text the text to search in
 * @param {QueryParam} query the search query
 * @returns {false|string} false if the text doesn't have the search query or is empty, otherwise returns the new text
 */
const replaceString = (text, query) => {
  const { searchQuery, replaceQuery, regexFlags, isRegex, matchWhole } = query;

  const flags = regexFlags.join("");

  let reg;
  if (isRegex) {
    reg = RegExp(searchQuery, flags);
  } else {
    reg = matchWhole
      ? RegExp(`\\b${escapeSearchQuery(searchQuery)}\\b`, flags)
      : (reg = RegExp(escapeSearchQuery(searchQuery), flags));
  }

  // if the text doesn't have the search query or is empty
  if (!text.match(reg) || text.length === 0) {
    return false;
  }
  return text.replaceAll(reg, replaceQuery);
};

/**
 * read a file and replace a string in it
 * @param {string} filePath the file path to search in
 * @param {QueryParam} query the search query
 * @returns {false|void} false if the file doesn't have the search query or is empty, otherwise write the new text into file
 */
const replaceStringInFile = async (filePath, query) => {
  const text = await fs.promises.readFile(filePath, { encoding: "utf-8" });
  if (/\ufffd/.test(text)) {
    return false;
  }
  const newText = replaceString(text, query);
  if (newText === false) {
    return false;
  }
  await fs.promises.writeFile(filePath, newText, { encoding: "utf-8" });
};

// getting all the files in each directory
// search and replacing the string in each file
/**
 *
 * @param {EchoSearchParam} echoSearchQuery the search query
 * @param {Function} onComplete a function to call when the search is complete
 * @param {Function} onError a function to call when the search fails
 * @param {Function} onUpdate a function to call when there is a progress update (eg. total files, file updated, etc.)
 */
const echoSearch = async (echoSearchQuery, onComplete, onError, onUpdate) => {
  const { directories, fileTypes, excludes, query } = echoSearchQuery;
  let progress = 0;
  const files = [];
  for (const directory of directories) {
    const dirFiles = await crawlDirectory(directory, fileTypes, excludes);
    files.push(...dirFiles);
  }
  const singleFileProgress = 100 / files.length;
  let updatedFilesCount = 0;
  // wait for 100ms to let the UI update
  await new Promise((resolve) => setTimeout(resolve, 100));
  onUpdate &&
    onUpdate({
      progress,
      message: `Found ${files.length} files.`,
      mode: "success",
    });
  for (const file of files) {
    try {
      const updatedFile = await replaceStringInFile(file, query);
      if (updatedFile !== false) {
        updatedFilesCount++;
        onUpdate &&
          onUpdate({
            progress,
            message: `Updated ${file}`,
            mode: "info",
          });
      } else {
        onUpdate &&
          onUpdate({
            progress,
            mode: "info",
          });
      }
    } catch (error) {
      onUpdate &&
        onUpdate({
          progress,
          message: `Couldn't read file ${file}`,
          mode: "error",
          error,
        });
    }
    progress += singleFileProgress;
  }
  onComplete &&
    onComplete({
      message: `Search Completed: ${updatedFilesCount} files updated`,
    });
};

module.exports = echoSearch;