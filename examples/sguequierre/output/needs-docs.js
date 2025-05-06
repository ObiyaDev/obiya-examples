function sortByProperty(array, property) {
/**
   * Sorts an array of objects by a specified property in ascending order.
   * 
   * @param {Object[]} array - The array of objects to be sorted.
   * @param {string} property - The property on which the array should be sorted.
   * @returns {Object[]} A new array sorted by the specified property.
   * 
   * @example
   * sortByProperty([{name: 'John', age: 30}, {name: 'Jane', age: 20}], 'age');
   * // returns [{name: 'Jane', age: 20}, {name: 'John', age: 30}]
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
   * @param {Object[]} array - The array of objects to filter.
   * @param {string} key - The key of the object to match.
   * @param {string|number|boolean} value - The value of the key to match.
   * @returns {Object[]} The filtered array of objects where the object's key matches the provided value.
   */
    return array.filter(item => item[key] === value);
  }
  
  function groupByProperty(array, property) {
```js
/**
 * This function groups an array of objects by a specific property.
 * It uses the Array.prototype.reduce method to iterate over the array and group the objects based on the specified property.
 *
 * @param {Array} array - The array of objects to be grouped.
 * @param {string} property - The property on which the array of objects should be grouped.
 * @returns {Object} An object where the keys are the values of the specified property and the values are arrays of objects that have that property value.
 *
 * @example
 * const array = [{name: 'Alice', age: 20}, {name: 'Bob', age: 20}, {name: 'Charlie', age: 25}];
 * const grouped = groupByProperty(array, 'age');
 * console.log(grouped); // { '20': [ { name: 'Alice', age: 20 }, { name: 'Bob', age: 20 } ], '25': [ { name: 'Charlie', age: 25 } ] }
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