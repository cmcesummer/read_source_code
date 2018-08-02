# react-redux

## 入口

```javascript
export { Provider, createProvider, connectAdvanced, connect };
```

常用的估计也就 `Provider` `connect`, 所以就先看这两个;

## Provider

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

调用方式 ：``
