function quick(array, start, end) {
    if (start < end) {
        let left = start, right = end;
        const middle = array[left];
        while (left < right) {
            if (left < right && array[right] > middle) {
                right--;
            }
            array[left] = array[right];
            if (left < right && array[left] <= middle) {
                left++;
            }
            array[right] = array[left]
        }
        array[left] = middle;
        quick(array, start, left - 1);
        quick(array, left + 1, end);
    }
}

var arr = [2, 4, 65, 2, 7, 3, 3, 1];

quick(arr, 0, arr.length - 1);

console.log(arr)