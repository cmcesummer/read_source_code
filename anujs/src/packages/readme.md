## react16 的迷你实现

core: 放置一些公用接口

fiber: 放置调度器，比较有趣. 包含有时间分片，错误处理，批量更新，任务收集，任务分拣。。。

render: 放置渲染层的具体实现，比如 createElement, 在 dom 里面就是 document.createElement, 它会考虑到复杂的文档空间切换;

在 noop 里只是一个包含 type, props, children 的纯对象; 在 server 里面就是可以一个能序列化为字符串的对象。
