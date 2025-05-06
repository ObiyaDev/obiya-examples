function sortByProperty(array, property) {
/**
   * Sorts an array of objects by a specific property in ascending order.
   * 
   * @param {Object[]} array - The array of objects to be sorted.
   * @param {string} property - The property of the objects by which the array should be sorted.
   * @returns {Object[]} A new array sorted by the specified property.
   *
   * @example
   * // returns [{name: 'Alice', age: 25}, {name: 'Bob', age: 30}]
   * sortByProperty([{name: 'Bob', age: 30}, {name: 'Alice', age: 25}], 'name')
   */
    return [...array].sort((a, b) => {
      if (a[property] < b[property]) return -1;
      if (a[property] > b[property]) return 1;
      return 0;
    });
  }
  
  function filterByValue(array, key, value) {
/**
   * Filters an array of objects by a specific key-value pair.
   *
   * @param {Object[]} array - The array of objects to be filtered.
   * @param {string} key - The key of the object to filter by.
   * @param {string|number|boolean} value - The value of the key to filter by.
   * @returns {Object[]} The filtered array of objects.
   */
    return array.filter(item => item[key] === value);
  }
  
  function groupByProperty(array, property) {
```js
/**
 * This function groups an array of objects by a specified property.
 * 
 * @param {Array} array - The array of objects to be grouped.
 * @param {string} property - The property on which to group the objects.
 * 
 * @returns {Object} An object where each property is an array of objects from the input array that have the same value for the specified property.
 * 
 * @example
 * 
 * groupByProperty([{a: 1, b: 2}, {a: 2, b: 3}, {a: 1, b: 4}], 'a');
 * // returns {1: [{a: 1, b: 2}, {a: 1, b: 4}], 2: [{a: 2, b: 3}]}
 * 
 * @module groupByProperty
 */
```
    return array.reduce((grouped, item) => {
      const key = item[property];
      grouped[key] = grouped[key] || [];
      grouped[key].push(item);
      return grouped;
    }, {});
  }
  
  module.exports = {
    sortByProperty,
    filterByValue,
    groupByProperty
  };