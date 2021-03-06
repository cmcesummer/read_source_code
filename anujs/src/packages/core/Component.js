import { toWarnDev, returnFalse, returnTrue } from "./util";
import { Renderer } from "./createRenderer";

export const fakeObject = {
    enqueueSetState: returnFalse,
    isMounted: returnFalse
};
/**
 *组件的基类
 *
 * @param {any} props
 * @param {any} context
 */
export function Component(props, context) {
    //防止用户在构造器生成JSX

    Renderer.currentOwner = this;
    this.context = context;
    this.props = props;
    this.refs = {};
    this.updater = fakeObject;
    this.state = null;
}

Component.prototype = {
    constructor: Component, //必须重写constructor,防止别人在子类中使用Object.getPrototypeOf时找不到正确的基类
    replaceState() {
        toWarnDev("replaceState", true);
    },
    isReactComponent: returnTrue,
    isMounted() {
        toWarnDev("isMounted", true);
        return this.updater.isMounted(this);
    },
    setState(state, cb) {
        // 在 createInstance 中  instance.updater.enqueueSetState = Renderer.updateComponent;  动态修改了enqueueSetState
        // updateComponent 参数是 当前的组件实例， 新的state
        this.updater.enqueueSetState(this, state, cb);
    },
    forceUpdate(cb) {
        this.updater.enqueueSetState(this, true, cb);
    },
    render() {
        throw "must implement render";
    }
};
