function sortByProperty(array, property) {
/**
   * Sorts an array of objects by a specific property.
   *
   * @function sortByProperty
   * @param {Object[]} array - The array of objects to be sorted.
   * @param {string} property - The property of the object to sort by.
   * @returns {Object[]} A new array sorted by the specified property.
   * @example
   * 
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
   * @param {Object[]} array - The array of objects to be filtered.
   * @param {string} key - The key of the object to match the value against.
   * @param {*} value - The value to match against the object's key.
   * @returns {Object[]} Returns a new array consisting of objects from the input array that have a matching key-value pair.
   */
    return array.filter(item => item[key] === value);
  }
  
  function groupByProperty(array, property) {
```js
/**
 * Groups an array of objects by a specified property.
 *
 * @param {Object[]} array - The array of objects to be grouped.
 * @param {string} property - The property on which to group the objects.
 * @returns {Object} An object with keys representing the property values and values being arrays of objects that have that property value.
 * @example
 * // returns { '1': [{ id: 1, name: 'John' }], '2': [{ id: 2, name: 'Jane' }] }
 * groupByProperty([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }], 'id');
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