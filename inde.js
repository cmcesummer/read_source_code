function quick(arr, start = 0, end = arr.legth) {
    if (start < end) {
        let left = start,
            right = end;
        const middle = arr[left];
        while (left < right) {
            while (left < right && arr[right] > middle) {
                right--;
            }
            arr[left++] = arr[right];
            while (left < right && arr[left] <= middle) {
                left++;
            }
            arr[right--] = arr[left];
        }
        arr[left] = middle;
        quick(arr, start, left - 1);
        quick(arr, left + 1, end);
    }
}
