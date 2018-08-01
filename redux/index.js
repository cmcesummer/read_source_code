function createStore(reduces, globalState) {
    const state = globalState;
    const getState = () => state;
    const listenArr = [];
    const subscribe = fn => {
        listenArr.push(fn)
    }
    const dispatch = (actions) => {
        state = reduces(state, actions)
        listenArr.forEach(item => item())
        return actions
    }
    dispatch({ type: '@@redux' })
    return { getState, subscribe, dispatch }
}

// 一个 reduce
const baseState = { ccc: 'aaa', act: "11" }
function reduce(state = baseState, actions) {
    switch (actions.type) {
        case '11':
            return { ...state, act: '222' };
        default:
            return state
    }
}

// reduce 合并函数
function combineReducers(obj) {
    const reducesMap = obj;
    return function (state = {}, actions) {

    }
}

