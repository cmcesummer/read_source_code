# redux

一下是我基于对源码的理解写的伪代码

## createStore

createStore 伪代码

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
    dispatch({type: @@aa@@});
    return {getState, subscribe, dispatch}
```

由 `createStore` 函数创建了一个闭包， 全局的 `state` 就储存在该闭包中。

## combineReducers

createStore 中的 reduces 一般是通过 combineReducers 合并生成的

combineReducers 伪代码

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

简化一下

```javascript
function combineReducers(reducers) {
    return function reduce(oldAllState = {}, actions) {
        const keyArr = Object.keys(reducers);
        const newAllState = {};
        let change = false;
        for (let key of keyArr) {
            const oldSingleState = oldAllState[key];
            const newSingleState = reducers[key](oldSingleState, actions);
            newAllState[key] = newSingleState;
            change = change || newSingleState !== oldSingleState;
        }
        return change ? newAllState : oldAllState;
    };
}
```

这里注意伪代码第 14 行， `change = change || newState !== state` 这就是 reducer 中 return 出的对象不允许在原 state 上改的原因，一定要 `{ ...state, ...other}` 这种方式的原因。

## applyMiddleware

中间件的写法都是这样的：

```
const plugins = store => next => actions => {
    if(actions.url) {
        Promise.resolve(res => next(actions))
    }
}
```

调用的时候可以这么写

```
store = applyMiddleware([...Plugins])(createStore)(reducers, initState);
```

所以 applyMiddleware 应该是：

```js
func applyMiddleware(...middlewares):
    return createStore => (reducers, initState) => :
        const store = createStore(reducers, initState)
        const { getState, dispatch } = store
        // 这里 item(store) 由 `store => next => action => {}` 变成 `next => action => {}`
        const chain = middlewares.map(item => item({ getState, dispatch }))
        dispatch = compose(...chain, dispatch)
        return { ...store, dispatch }
```

关于 compose 函数：  
需要由 `next => action => {}` 变成 `action => {}`

```js
func compose(...args):
    const dipatch = args[args.length - 1]
    const pluginArr = args.slice(-1)
    return pluginArr.reduceRight((lastFn,nextFn) => nextFn(lastFn), dispatch)
```

所以`Plugin`中的`next`就是下一个函数`lastFn`(命名原因，因为是从右往左嵌套，实际上从左向右看就是下一个函数)。最后返回的`dispatch`是一个层层嵌套的函数，最内层是`store.dispatch`, 需要把`actions`一层层传递下去。  
但其实官方给的代码不是这样的，在`compose`返回的是以`dispatch`为参数的函数（我的伪函数效果一样，不知道为什么要官方这样实现）（回过头来再看，可能是因为这样好理解，并且与 dispatch 函数解耦）。代码如下：

```javascript
// applyMiddleware dispatch 是这样覆盖的
dispatch = compose(...chain)(store.dispatch);
// For example, compose(f, g, h) is identical to doing (...args) => f(g(h(...args))).
function compose(...funcs) {
    if (funcs.length === 0) {
        return arg => arg;
    }
    if (funcs.length === 1) {
        return funcs[0];
    }
    // pluginArr = [a,b,c, d] =>
    // 最右边的先执行  A -> B -> C -> dispatch -> C -> B -> A
    return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
```

## 图示

添加一下我画的实现思路

-   createStore 和 combineReducers
    ![createStore + combineReducers](https://github.com/cmcesummer/read_source_code/blob/master/redux/img/redux_1.png)

-   applyMiddleware
    ![applyMiddleware](https://github.com/cmcesummer/read_source_code/blob/master/redux/img/redux_2.png)
