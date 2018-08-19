# preact

看上去代码挺少的，先读一读这个找找感觉。争取一周内看完。  
先采用添加源码注释的形式进行阅读。


## 看完了 
看完了，总感觉这个diff算法不行啊，不高效，一层层的对比 dom 和 vnode 会行么， 还有个大问题就是绑定事件的问题。完全没有代理，这要是多了不就废了。  

那大致总结一下 preact 的一些方法吧。

### ./component
这个是需要继承的那个 Component 类。包含基础的 props, context, state, setState, forceUpdate 属性和方法。  
其中 setState 触发 `enqueueRender`, forceUpdate 触发 `renderComponent(this, true)`  。  
这里 `enqueueRender`其实就是异步的 `renderComponent`。

## vdom
这个文件夹下是核心内容

### ./vdom/diff 

主要核心方法：   
- `diff` :   
在 `render` 方法中调用一次，在`renderComponent` 中调用一次。并调用 idiff 产生的 真是 dom，并return出去。这里的参数第一个是dom , 这个参数在 render 调用的时候是没有的,这时直接渲染，当 存在 dom 的时候是进行对比并更改dom的。    
- `idiff` ：  
这里分几个情况， 当第二个参数 vnode 是 string或者number时 说明是最内层了，直接 nodeValue = vnode; 当 nodeName 是 function 时调用 `buildComponentFromVNode`；当 nodeName 是普通string， 比如 div 这种。这时 去调用 innerDiffNode 递归 子元素。   
- `innerDiffNode`：   
是第一次渲染 还是 update 是根据 第一个参数 dom 有没有 childrNodes 来判断的。然后循环 vchildren, 循环的时候调用 idiff，进行递归，直到 idiff 返回的是 string， number 之类的。返回之后就插入到 dom 中。   
这三个递归调用.

### ./vdom/component

- `setComponentProps` ：   
对context 和 props 的操作，然后调用 renderComponent.  调用改方法的地方只有 renderComponent 和 buildComponentFromVNode。
- `renderComponent`：    
调用该方法的地方只有： `setComponentProps`. 这个函数里有一些生命周期的钩子函数，以及context的赋值等。作用是把 `diff`函数生成的dom挂到传入的第一个参数 component的 base 属性上，component是Component的实例化。是第一次渲染 还是 update 是根据 component 是不是存在 base 属性 判断的。当更新的时候进行 dom 与 vnode 的循环比较的dom是 component的base属性是这个 dom.      
- `buildComponentFromVNode`:     
当 nodeName 是 function 时 ，比如 `<Modal>`这种调用这个方法，这个方法中实例化 这个function , 然后当做第一个参数传参，调用 `setComponentProps`继续渲染。  


## 流程
所以流程就跟简单了。   
渲染的时候 ：   
render => diff => idiff => innerDiffNode => idiff => ...递归...  => diff (添加到html的dom中) 渲染完成   
更新的时候 ：   
setState => renderComponent => diff => idiff => innerDiffNode =>  ...递归... => diff 更新完成

