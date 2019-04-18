function createStore(reduces, globalState) {
    const state = globalState;
    const getState = () => state;
    const listenArr = [];
    const subscribe = fn => {
        listenArr.push(fn);
    };
    // 因为闭包的存在 所以 state 一直存在内存中
    const dispatch = actions => {
        state = reduces(state, actions);
        listenArr.forEach(item => item());
        return actions;
    };
    dispatch({ type: "@@redux" });
    return { getState, subscribe, dispatch };
}

// 一个 reduce
const baseState = { ccc: "aaa", act: "11" };
function reduce(state = baseState, actions) {
    switch (actions.type) {
        case "11":
            return { ...state, act: "222" };
        default:
            return state;
    }
}

// reduce 合并函数
// 如果使用了 combineReducers 那么 globalState 的格式一定是 {key: {}, key: {}} 的格式， key 是单个 reduce 的函数名，或自己命名
function combineReducers(obj) {
    const reducesMap = obj;
    return function(state = {}, actions) {
        const finMap = {};
        let change = false;
        for (let key in reducesMap) {
            const prevStateItem = state[key];
            const nextStateItem = reducesMap[key](prevStateItem, actions);
            finMap[key] = nextStateItem;
            change = change || prevStateItem !== nextStateItem;
        }
        return change ? finMap : state;
    };
}
