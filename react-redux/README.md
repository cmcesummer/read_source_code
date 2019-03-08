# react-redux

## 入口

```javascript
export { Provider, createProvider, connectAdvanced, connect };
```

常用的估计也就 `Provider` `connect`, 所以就先看这两个;

## Provider

通过 `props` 传入 `store` 。 再通过 `getChildContext() {return { ... }}`, `static childContextTypes { ... }` 向下传递

```javascript
const subscriptionKey = `${storeKey}Subscription`;
const storeKey = "store";
class Provider extends Component {
    getChildContext() {
        return { [storeKey]: this[storeKey], [subscriptionKey]: null };
    }

    static propTypes = {
        store: storeShape.isRequired,
        children: PropTypes.element.isRequired
    };

    static childContextTypes = {
        [storeKey]: isRequired,
        [subscriptionKey]: xxx
    };

    constructor(props, context) {
        super(props, context);
        this[storeKey] = props.store;
    }

    render() {
        // Children.only 只允许有一个子节点
        return Children.only(this.props.children);
    }
}
```

## connect

调用方式 ：`connect(mapStateToProps, mapDispatchToProps)(Component)`;  
其中 `mapStateToProps` 的定义方式：

```javascript
const mapStateToProps = state => {
    return {
        todoList: state.todoList
    };
};
```

`mapDispatchToProps` 的定义方式：

```javascript
const actions = {
    decrease: (args) => {
        return {
            type:'PAGEA/DECREASE'，
            args
        }
    }
}
const mapStateToProps = dispatch => {
    return {
        decrease: (...args) => dispatch(actions.decrease(...args))
    };
};
```

connect:
只有 `setState` 会触发 render

```javascript
function connect ( mapStateToProps, mapDispatchToProps, mergeProps, {} ) {
    return connectHOC(selectorFactory, { ... })
}
```

在 `connectAdvanced.js` 中 的 `onStateChange` 方法是通过 `store.subscribe()` 注册到 `listen` 上， 在 `dispatch` 中触发的。  
给一个空对象 `dummyState = {}` 即可触发 `render`.  
所以每 connect 一次就会多一个`subscribe`。  
在这层组件中触发渲染而不是在 `Provider` 中是为了优化性能。 在 `Provider` 中订阅的必然要在 `Provider` 触发 `setState`, 整个应用都会重新 `render` 一遍。 而在 `HOC` 中则只会在该组件重新 `render`。除此之外`HOC`中还会判断是否跟上次的`state`一样， 一样的话就不重新 `render`， 比较的是通过 `mapStateToProps` 返回的属性。

`connectAdvanced.js`

```javascript
const dummyState = {};
onStateChange = () => {
    this.selector.run(this.props);
    if (!this.selector.shouldComponentUpdate) {
        this.notifyNestedSubs();
    } else {
        this.componentDidUpdate = this.notifyNestedSubsOnComponentDidUpdate;
        this.setState(dummyState);
    }
};

render() {
    // render后就设置成false
    selector.shouldComponentUpdate = false
    // ...
    return (
        // ...
    )
}

function makeSelectorStateful(sourceSelector, store) {
  // wrap the selector in an object that tracks its results between runs.
  const selector = {
    run: function runComponentSelector(props) {
      try {
        const nextProps = sourceSelector(store.getState(), props)
        if (nextProps !== selector.props || selector.error) {
            // 这里进行比较， 不同设置成 true 可以继续setState
          selector.shouldComponentUpdate = true
          // 这里赋值, 下次进行比较
          selector.props = nextProps
          selector.error = null
        }
      } catch (error) {
        selector.shouldComponentUpdate = true
        selector.error = error
      }
    }
  }

  return selector
}
```

`Subscription.js`

```javascript
export default class Subscription {
    // ...
    trySubscribe() {
        if (!this.unsubscribe) {
            this.unsubscribe = this.parentSub
                ? this.parentSub.addNestedSub(this.onStateChange)
                : this.store.subscribe(this.onStateChange);

            this.listeners = createListenerCollection();
        }
    }
    // ...
}
```

## createContext

React 在新版本提供了新的 API。 `React.createContext` 实现一个类似 `react-redux` 的功能的库 [链接](https://github.com/cmcesummer/read_source_code/tree/master/react-redux/src)。 目前共=功能还不完善 缺少一些优化。
后续继续改进优化， 添加比较。

## ...

这几天看其他项目看的崩溃了，赶紧来阅读源码压压惊，暗示一下自己不菜鸡
