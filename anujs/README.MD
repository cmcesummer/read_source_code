# ~
最近又尝试去看一遍 react-dom , 又失败了，看着看着就懵逼了，于是再看看这个国产类 react 框架，继续学习一下。看作者自己说这个 anujs 跑通了 react 官方 百分之九十几的测试用例，也实现了 fiber 架构，可以学习下。

## 一些知识补充吧

### requestIdleCallback

`requestAnimationFrame` 16s 执行一次， 在16s内有各种事件， 这个 requestIdleCallback 就是插入这个空隙去执行，不建议在这里边执行 dom 操作，会有性能问题。 
```javascript
function myNonEssentialWork (deadline) {
  while (deadline.timeRemaining() > 0 && tasks.length > 0)
    doWorkIfNeeded();

  if (tasks.length > 0)
    requestIdleCallback(myNonEssentialWork);
}
```

### DFS 

深度优先搜索(DFS, Depth First Search)是一个针对图和树的遍历算法。早在19世纪就被用于解决迷宫问题。    
DFC的详细解释还是贴个链接吧。 [深度优先搜索](https://blog.csdn.net/saltriver/article/details/54429068)  

### toString(radix)

`number.toString(36)`转换成36进制啊，一般都是为了生成不重复的随机数才调用的.

