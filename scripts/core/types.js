/** @typedef {string} ThreadId */

/**
 * @typedef {Object} ChatMessage
 * @property {"user"|"assistant"} role
 * @property {string} content
 */

/**
 * @typedef {Object} ThreadMeta
 * @property {string} id
 * @property {string} url
 * @property {string} title
 * @property {number} updatedAt
 * @property {number} messageCount
 */

/**
 * @typedef {Object} FileListItem
 * @property {string} path
 * @property {string} [kind]
 * @property {string} [summary]
 */

export {};
