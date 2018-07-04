# redux

一下是我基于对源码的理解写的伪代码  
  
createStore伪代码
```
func createStore(reduces, initstate):
    let currentState = initstate
    const getState() => currentState
    const ListenArr = []
    const subscribe(fn) => ListenArr.push(fn)
    func dispatch(actions):
        currentState = reduces(currentState, actions)
        ListenArr.forEach(item => item())
        return actions
    return {getState, subscribe, dispatch}        
```
  
createStore中的reduces一般是通过combineReducers合并生成的  
  
combineReducers伪代码
```
func combineReducers({ ...reducerMap }):
    const finalReducers = {}
    for key in reducerMap:
        if (val = reducerMap[key]) is 'function':
            finalReducers[key] = val
    return func reducer(totalState={}, actions):
        let change = false;
        let nextState = {};
        for key in finalReducers：
            const state = totalState[key]
            const reduceItem = finalReducers[key]
            const newState = reduceItem(state, actions);
            nextState[key] = newState;
            change = change || newState !== state
        return change ? nextState : totalState
```  
这里注意伪代码第14行， `change = change || newState !== state` 这就是reducer中return出的对象不允许在原state上改的原因，一定要 ` { ...state, ...other} ` 这种方式的原因。

