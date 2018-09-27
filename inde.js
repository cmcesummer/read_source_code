function quick(arr, start = 0, end = arr.length - 1) {
    if (start < end) {
        let left = start,
            right = end;
        const middle = arr[left];
        while (left < right) {
            while (left < right && arr[right] > middle) {
                right--;
            }
            if (left < right) {
                arr[left] = arr[right];
                left++;
            }
            while (left < right && arr[left] <= middle) {
                left++;
            }
            if (left < right) {
                arr[right] = arr[left];
                right--;
            }
        }
        arr[left] = middle;
        quick(arr, start, left - 1);
        quick(arr, left + 1, end);
    }
}

let arr = [2, 1, 3, 4, 32, 5, 64, 6, 54, 6, 74, 7, 65, 67, 57];

quick(arr);
console.log(arr);
