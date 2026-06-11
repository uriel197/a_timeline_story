export function getNestedValue(arr, parentIndex, index = 0) {
  // Base case: if not an array or index out of bounds
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
    console.log("bug in nested value");
    return undefined; // or throw error, depending on needs
  }
  let value;
  if (parentIndex != null) {
    value = arr[parentIndex];
  } else {
    value = arr[index];
  }
  // If nested array, recurse with same index
  if (Array.isArray(value)) {
    return getNestedValue(value, index);
  } // Otherwise, return the number
  return value;
}
