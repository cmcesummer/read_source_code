import { Component } from '../component';

/**
 * Retains a pool of Components for re-use, keyed on component name.
 * Note: since component names are not unique or even necessarily available,
 * these are primarily a form of sharding.
 * @type {Object.<string, Component[]>}
 * @private
 */
const components = {};


/**
 * Reclaim a component for later re-use by the recycler.
 * @param {Component} component The component to collect
 */
export function collectComponent(component) {
    let name = component.constructor.name;
    (components[name] || (components[name] = [])).push(component);
}


/**
 * Create a component. Normalizes differences between PFC's and classful
 * Components.
 * @param {function} Ctor The constructor of the component to create
 * @param {object} props The initial props of the component
 * @param {object} context The initial context of the component
 * @returns {import('../component').Component}
 */
export function createComponent(Ctor, props, context) {
    // 参数 vnode.nodeName, props, context   Ctor 应该是个 func
    // 初次 render 时 list 应该是 undefined
    let list = components[Ctor.name],
        inst;

    if (Ctor.prototype && Ctor.prototype.render) {
        inst = new Ctor(props, context);
        // 这里的作用是什么 重新赋值属性 防止被覆盖吗 
        // 作用明显是 把 props context 赋值给 inst 的 this 
        // 但是我觉得没有这个也行啊 ？？？？ 
        Component.call(inst, props, context);
    }
    else {
        // 这个是处理 function 组件用的
        inst = new Component(props, context);
        inst.constructor = Ctor;
        inst.render = doRender;
    }

    // 初次 render 不走
    if (list) {
        for (let i = list.length; i--;) {
            if (list[i].constructor === Ctor) {
                inst.nextBase = list[i].nextBase;
                list.splice(i, 1);
                break;
            }
        }
    }
    // 返回实例化对象
    return inst;
}


/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
    return this.constructor(props, context);
}
