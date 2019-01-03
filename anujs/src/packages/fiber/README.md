## react-fiber

React16 的 fiber 调度器的迷你实现，将用户对虚拟 DOM 的所有操作进行更细致的划分，
调用底层 API 执行视图更新与业务逻辑

scheduleWork 主要包含两个方法`render`与`updateComponent`, 用于驱动视图变化。

render 即 ReactDOM.render, 内部会调用 updateComponent。
updateComponent 即组件的 setState/forceUpdate 的具体实现。

render 要跑起来，需要一个组件，因此 React.render(vdom, container, cb)中的前两个参数间会嵌入一个内置组件 Unbatch!
于是有 unbatch.js 模块。

```jsx
<container>
    <Unbatch>
        <vdom />
    </Unbatch>
</container>
```

render 会将 vdom 放进 macrotask 列队。

updateComponent 里面有一个 scheduleWork 方法。

scheduleWork 是 performWork 的封装

performWork 是 requestIdleCallback<伪>的回调。

requestIdleCallback 之所以带伪字，因为它不是浏览器的原生方法。 为了也能跑在 nodejs 端，React 内置了这同名方法，虽然参数与原生的很像，但它的行为会视平台有所不同。

```javascript
let deadline = {
    didTimeout: false,
    timeRemaining() {
        return 2;
    }
};

function requestIdleCallback(fn) {
    fn(deadline);
}
Renderer.scheduleWork = function() {
    performWork(deadline);
};
```

performWork 会像经典 rAF 动画那样递归调整自身，直到耗尽 macrotasks 里面的任务.

```javascript
function performWork(deadline) {
    //更新虚拟DOM与真实DOM
    workLoop(deadline);
    //忽略其他往macrotasks中添加任务的代码。。。
    //忽略其他往macrotasks中添加任务的代码。。。
    //忽略其他往macrotasks中添加任务的代码。。。
    if (macrotasks.length) {
        requestIdleCallback(performWork);
    }
}
```

macrotasks 是挂在 Renderer 下的 Renderer.macrotasks;
workLoop 相当于浏览器中的 EventLoop, 用于执行 macrotasks 与 micotasks 里面的任务。

1. macrotasks，宏列队，主进程，一个页面只有一个。
2. microtasks，微列队，子进程，每棵虚拟 DOM 树都有一个，放在根节点中。当组件执行 setState 后，它会找到根节点的 microtasks，然后放进去。然后在下次唤起 performWork 时，再将它们挪到同 macrotasks。

workLoop 里面有两个 DFS 遍历，分别来自 beginWork 的 reconcileDFS, commitWork 的 commitDFS。 reconcile 与 commit 代表了 React16 更新时的两个阶段。

beginWork 中有 updateClassComponent 与 updateHostComponent,分别用于更新组件与 DOM 的 `vnode`。

commitWork 主要是执行 DOM 操作， REF 操作， 组件的回调与错误边界。 进行的是 DOM 更新

insertPoint 用于决定 DOM 节点是插入位置。

ErrorBoundary 用于查找`边界组件`，及合成`错误组件`的位置信息。

effectTag 基于质数相除的任务系统。 这个 基于质数相除 有点牛逼

-   `Renderer.batchedUpdates`只有两个地方调用 一个是 事件系统中， 一个是 `commitWork.js` 中，猜测是生命周期
