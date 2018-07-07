# react-router 4 源码流程梳理

## 包含文件
[HashRouter](https://github.com/ReactTraining/react-router/blob/master/packages/react-router-dom/modules/HashRouter.js),
作为入口文件 , 是react-router-dom 4 中的文件     
[createHistory](https://github.com/ReactTraining/history/blob/master/modules/createHashHistory.js),  
[Router](https://github.com/ReactTraining/react-router/blob/master/packages/react-router/modules/Route.js)  
[Route](https://github.com/ReactTraining/react-router/blob/master/packages/react-router/modules/Route.js)  

## 文件分析

- HashRouter
有两行重要代码：
```javascript
// props一般都是空对象，
history = createHistory(this.props);

// Router 是 react-router 中的 Router
render() {
    return <Router history={this.history} children={this.props.children} />;
}
```

- createHistory
最终 return 出去的就是平时我们在组件中 `this.props.history` 能拿到的那些东西。  
这里我主要说一下三个方法 `push` `replace` `listen`，以及他们的辅助方法 :  
```javascript
// createTransitionManager.js：  
  let listeners = [];

  const appendListener = fn => {
    let isActive = true;
    const listener = (...args) => {
      if (isActive) fn(...args);
    };
    listeners.push(listener);
    return () => {
      isActive = false;
      listeners = listeners.filter(item => item !== listener);
    };
  };

  const notifyListeners = (...args) => {
    listeners.forEach(listener => listener(...args));
  };
```
 
```javascript
// createHistory.js：
// push 的实现
const pushHashPath = path => (window.location.hash = path);

// replace 的实现
const replaceHashPath = path => {
    const hashIndex = window.location.href.indexOf("#");
    window.location.replace(
        window.location.href.slice(0, hashIndex >= 0 ? hashIndex : 0) + "#" + path
    );
};

// 改变状态
const setState = nextState => {
    // 合并 history  
    // 代码跳转 location 就是在这里改变的。
    // 输入url回车 第一次渲染直接初始化拿到location, 不需要这里
    Object.assign(history, nextState);
    // 不知道这个 length 的意义在哪
    history.length = globalHistory.length;
    // 执行 Listener 
    transitionManager.notifyListeners(history.location, history.action);
};

// push  重要部分
const push = (path, state) => {
    // ...
    pushHashPath(encodedPath);
    // 新 location 
    setState({ action, location });
    // ...
}

// replace 重要部分
const replace = (path, state) => {
    // ...
    replaceHashPath(encodedPath);
    setState({ action, location });
    // ...
}

// 绑定监听事件
let listenerCount = 0;
const checkDOMListeners = delta => {
    listenerCount += delta;
    // 只添加一次监听事件
    if (listenerCount === 1) {
        window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) {
        window.removeEventListener(HashChangeEvent, handleHashChange);
    }
};

// 被绑定的监听事件
const handleHashChange = () => {
    // ...  一堆判断
    handlePop(location);
    // ... 
}

const handlePop = location => {
    // ...  一堆判断
    setState({ action, location });
    // ... 
}

// listener
const listen = listener => {
    const unlisten = transitionManager.appendListener(listener);
    // 在添加 listen 的同时添加绑定事件
    checkDOMListeners(1);
    return () => {
        checkDOMListeners(-1);
        unlisten();
    };
};
```

- Router
这是 `react-router` 中提供的文件，是个底层依赖。  
关键点： `{} !== {}` . 下面是关键代码：   
```javascript
class Router extends React.Component {
  // ...  
  // 这个的作用是上下传递 Router 内部还有 Router 的情况
  static contextTypes = {
    router: PropTypes.object
  };
  // this.context.router 是向下透传的一个对象
  static childContextTypes = {
    router: PropTypes.object.isRequired
  };

  getChildContext() {
    return {
      router: {
        ...this.context.router,
        // HashRouter 那里传来的 createHistory 函数返回的内容
        history: this.props.history,
        route: {
          location: this.props.history.location,
          match: this.state.match
        }
      }
    };
  }

  state = {
    match: this.computeMatch(this.props.history.location.pathname)
  };

  computeMatch(pathname) {
    return {
      path: "/",
      url: "/",
      params: {},
      isExact: pathname === "/"
    };
  }

  componentWillMount() {
    const { children, history } = this.props;
    // 在第一次渲染前添加 listener
    this.unlisten = history.listen(() => {
      this.setState({
        // 注意这里 {}!=={} 为 true, 所以每次都会触发 render，
        // 所以子组件的 componentWillReceiveProps(np,nc) 会触发
        match: this.computeMatch(history.location.pathname)
      });
    });
  }

  componentWillUnmount() {
    this.unlisten();
  }

  render() {
    const { children } = this.props;
    // 所以 <Router> 组件内只能有一个子元素，所以一般情况下 要么套 <div> 要么套<Switch> 
    return children ? React.Children.only(children) : null;
  }
}
```
- Route
Router 内部就是 Route 了。看看 Route 的部分代码吧， 这也是`react-router`提供的： 

```javascript
class Route extends React.Component {
  static propTypes = {
    computedMatch: PropTypes.object, // private, from <Switch>
    path: PropTypes.string,
    exact: PropTypes.bool,
    strict: PropTypes.bool,
    sensitive: PropTypes.bool,
    component: PropTypes.func,
    render: PropTypes.func,
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    location: PropTypes.object
  };

  static contextTypes = {
    router: PropTypes.shape({
      history: PropTypes.object.isRequired,
      route: PropTypes.object.isRequired,
      // 这是什么 还没弄清楚
      staticContext: PropTypes.object
    })
  };

  static childContextTypes = {
    router: PropTypes.object.isRequired
  };

  getChildContext() {
    return {
      router: {
        ...this.context.router,
        route: {
          location: this.props.location || this.context.router.route.location,
          match: this.state.match
        }
      }
    };
  }

  state = {
    match: this.computeMatch(this.props, this.context.router)
  };

  computeMatch(
    { computedMatch, location, path, strict, exact, sensitive },
    router
  ) {
    if (computedMatch) return computedMatch; // <Switch> already computed the match for us

    const { route } = router;
    // createHashHistory 生成的 当前url的hash
    const pathname = (location || route.location).pathname; 
    // 这里会返回一个 Object 或者 null,  通过 path 生成 pathname 的匹配正则表达式来比较
    // matchPath.js  exact 有影响  子组件需要 path={`${this.props.mathc.url}/name`} 来匹配
    // 这里就包含了 <Route> 里套 <Route> 的情况  
    return matchPath(pathname, { path, strict, exact, sensitive }, route.match);
  }

  componentWillReceiveProps(nextProps, nextContext) {
    // 父组件 触发 context 改变， 这里setState, match 改变的组件重新 render 
    this.setState({
      match: this.computeMatch(nextProps, nextContext.router)
    });
  }

  render() {
    const { match } = this.state;
    const { children, component, render } = this.props;
    const { history, route, staticContext } = this.context.router;
    const location = this.props.location || route.location;
    // 还是不太清楚 staticContext 是什么。
    // TODO: 这里记得实例看一下
    const props = { match, location, history, staticContext };
    // 接受两种 component 和 render 渲染属性
    if (component) return match ? React.createElement(component, props) : null;

    if (render) return match ? render(props) : null;

    if (typeof children === "function") return children(props);

    if (children && !isEmptyChildren(children))
      return React.Children.only(children);

    return null;
  }
}
```

到这里 router 的流程就基本清晰了。   
`BrowerRouter` 与 `HashRouter` 大同小异 就是:
- 监听方法不同：  `popstate` `hashchange`
- 替换 跳转 url 不同： `pushState(state, null, url)` `replaceState(state, null, url)`;


## 流程图
![router流程图](https://github.com/cmcesummer/read_source_code/blob/master/react-router4/img/router.png)

## 其他
流程就这些， 其实一些辅助函数我都没分析，这些辅助函数也挺关键的。



