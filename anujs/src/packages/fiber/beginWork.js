import { extend, typeNumber, isFn, gDSFP, gSBU } from "react-core/util";
import { fiberizeChildren } from "react-core/createElement";
import { AnuPortal } from "react-core/createPortal";

import { Renderer } from "react-core/createRenderer";
import { createInstance, UpdateQueue } from "./createInstance";
import { Fiber } from "./Fiber";
import {
    PLACE,
    ATTR,
    HOOK,
    CONTENT,
    REF,
    //  NULLREF,
    CALLBACK,
    NOWORK,
    WORKING
} from "./effectTag";
import { guardCallback, detachFiber, pushError, applyCallback } from "./ErrorBoundary";

import { getInsertPoint, setInsertPoints } from "./insertPoint";

/**
 * 基于DFS遍历虚拟DOM树，初始化vnode为fiber,并产出组件实例或DOM节点
 * 为instance/fiber添加context与parent, 并压入栈
 * 使用再路过此节点时，再弹出栈
 * 它需要对updateFail的情况进行优化
 */

export function reconcileDFS(fiber, info, deadline, ENOUGH_TIME) {
    var topWork = fiber;
    outerLoop: while (fiber) {
        // deadline.timeRemaining() => 2
        // disposed 好像还没有
        if (fiber.disposed || deadline.timeRemaining() <= ENOUGH_TIME) {
            break;
        }
        let occurError;
        // fiber.tag 代表的是什么
        // fiber.tag < 3 是走的组件更新
        if (fiber.tag < 3) {
            let keepbook = Renderer.currentOwner;
            try {
                // 为了性能起见，constructor, render, cWM,cWRP, cWU, gDSFP, render
                // getChildContext都可能 throw Exception，因此不逐一try catch
                // 通过fiber.errorHook得知出错的方法
                // 用于更新组件
                updateClassComponent(fiber, info); // unshift context
            } catch (e) {
                occurError = true;
                pushError(fiber, fiber.errorHook, e);
            }
            Renderer.currentOwner = keepbook;
            if (fiber.batching) {
                delete fiber.updateFail;
                delete fiber.batching;
            }
        } else {
            // 用于更新DOM
            updateHostComponent(fiber, info); // unshift parent
        }
        //如果没有阻断更新，没有出错
        if (fiber.child && !fiber.updateFail && !occurError) {
            // 这里开始深度优先
            fiber = fiber.child;
            continue outerLoop;
        }

        let f = fiber;
        while (f) {
            let instance = f.stateNode;
            if (f.tag > 3 || f.shiftContainer) {
                if (f.shiftContainer) {
                    //元素节点与AnuPortal
                    delete f.shiftContainer;
                    info.containerStack.shift(); // shift parent
                }
            } else {
                let updater = instance && instance.updater;
                if (f.shiftContext) {
                    delete f.shiftContext;
                    info.contextStack.shift(); // shift context
                }
                if (f.hasMounted && instance[gSBU]) {
                    // before update DOM
                    updater.snapshot = guardCallback(instance, gSBU, [updater.prevProps, updater.prevState]);
                }
            }

            if (f === topWork) {
                break outerLoop;
            }
            if (f.sibling) {
                fiber = f.sibling;
                continue outerLoop;
            }
            f = f.return;
        }
    }
}

// DOM 更新
function updateHostComponent(fiber, info) {
    const { props, tag, alternate: prev } = fiber;
    // alternate 是 旧的 vdom 节点
    // fiber.stateNode 是挂载在该 fiber 上的真实 dom 节点
    if (!fiber.stateNode) {
        fiber.parent = info.containerStack[0];
        fiber.stateNode = Renderer.createElement(fiber);
    }
    // parent 是真实 dom
    const parent = fiber.parent;
    /* if (!parent.insertPoint) {
        parent.insertPoint = getInsertPoint(fiber);
    }
    */

    // 下边这两个赋值 是？
    fiber.forwardFiber = parent.insertPoint;

    parent.insertPoint = fiber;
    // 1 = 3
    fiber.effectTag = PLACE;
    if (tag === 5) {
        // 元素节点
        fiber.stateNode.insertPoint = null;
        info.containerStack.unshift(fiber.stateNode);
        fiber.shiftContainer = true;
        //  3 *= 7
        fiber.effectTag *= ATTR;
        if (fiber.ref) {
            fiber.effectTag *= REF;
        }
        // 生成了新的 vdom
        diffChildren(fiber, props.children);
    } else {
        if (!prev || prev.props !== props) {
            //  3 *= 5
            fiber.effectTag *= CONTENT;
        }
    }
}

function mergeStates(fiber, nextProps) {
    let instance = fiber.stateNode,
        pendings = fiber.updateQueue.pendingStates,
        n = pendings.length,
        // fiber.memoizedState 保存着 getDerivedStateFromProps 合并后的 state
        state = fiber.memoizedState || instance.state;
    if (n === 0) {
        return state;
    }

    let nextState = extend({}, state); // 每次都返回新的state
    let fail = true;
    for (let i = 0; i < n; i++) {
        let pending = pendings[i];
        if (pending) {
            if (isFn(pending)) {
                let a = pending.call(instance, nextState, nextProps);
                if (!a) {
                    continue;
                } else {
                    pending = a;
                }
            }
            fail = false;
            extend(nextState, pending);
        }
    }

    if (fail) {
        return state;
    } else {
        return (fiber.memoizedState = nextState);
    }
}

// 用于更新组件
export function updateClassComponent(fiber, info) {
    // 这里好像只有 reconcileDFS 调用了
    let { type, stateNode: instance, props } = fiber;
    let { contextStack, containerStack } = info;
    // type 是 组件类, contextTypes 是 type 的静态属性 static ， 合并 context
    let newContext = getMaskedContext(instance, type.contextTypes, contextStack);
    if (instance == null) {
        fiber.parent = type === AnuPortal ? props.parent : containerStack[0];
        // 这个的作用就是实例化组件，实例上挂_reactInternalFiber等 并返回实例
        instance = createInstance(fiber, newContext);
        cacheContext(instance, contextStack[0], newContext);
    }

    instance._reactInternalFiber = fiber; //更新rIF
    const isStateful = !instance.__isStateless;
    if (isStateful) {
        //有狀态组件
        // 这里是 { pendingCbs: [callback], pendingStates:[{child:{...}}] }
        let updateQueue = fiber.updateQueue;

        delete fiber.updateFail;
        // 这里判断有没有渲染过， 渲染过就走更新钩子
        if (fiber.hasMounted) {
            applybeforeUpdateHooks(fiber, instance, props, newContext, contextStack);
        } else {
            applybeforeMountHooks(fiber, instance, props, newContext, contextStack);
        }
        // 在上边两个函数中 memoizedState_ 已经更新到最新了
        if (fiber.memoizedState) {
            // 更新state
            instance.state = fiber.memoizedState;
        }
        fiber.batching = updateQueue.batching;
        let cbs = updateQueue.pendingCbs;
        if (cbs.length) {
            fiber.pendingCbs = cbs;
            // effectTag 初始值 1  callback 23
            fiber.effectTag *= CALLBACK;
        }
        if (fiber.ref) {
            // REF = 19
            fiber.effectTag *= REF;
        }
    } else if (type === AnuPortal) {
        //无狀态组件中的传送门组件
        containerStack.unshift(fiber.parent);
        fiber.shiftContainer = true;
    }
    //存放它上面的所有context的并集
    //instance.unmaskedContext = contextStack[0];
    //设置新context, props, state
    instance.context = newContext;
    fiber.memoizedProps = instance.props = props;
    fiber.memoizedState = instance.state;

    if (instance.getChildContext) {
        let context = instance.getChildContext();
        context = Object.assign({}, contextStack[0], context);
        fiber.shiftContext = true;
        contextStack.unshift(context);
    }

    if (isStateful) {
        if (fiber.parent && fiber.hasMounted && fiber.dirty) {
            // 查找它后面的节点
            fiber.parent.insertPoint = getInsertPoint(fiber);
        }
        if (fiber.updateFail) {
            cloneChildren(fiber);
            fiber._hydrating = false;
            return;
        }

        delete fiber.dirty;
        // HOOK = 17 所以 effectTag 是干嘛的
        fiber.effectTag *= HOOK;
    } else {
        fiber.effectTag = WORKING;
    }

    if (fiber.catchError) {
        return;
    }
    Renderer.onUpdate(fiber);
    fiber._hydrating = true;
    Renderer.currentOwner = instance;
    // render 产生新的 vdom
    let rendered = applyCallback(instance, "render", []);
    // 把新的 vnode 挂在 fiber 上， 也就是添加 fiber 的child, vnode 的 subling, forward 等属性
    diffChildren(fiber, rendered);
}

function applybeforeMountHooks(fiber, instance, newProps) {
    fiber.setout = true;
    if (instance.__useNewHooks) {
        setStateByProps(instance, fiber, newProps, instance.state);
    } else {
        callUnsafeHook(instance, "componentWillMount", []);
    }
    delete fiber.setout;
    mergeStates(fiber, newProps);
    // update完了 重置 queue
    fiber.updateQueue = UpdateQueue();
}

function applybeforeUpdateHooks(fiber, instance, newProps, newContext, contextStack) {
    const oldProps = fiber.memoizedProps;
    const oldState = fiber.memoizedState;
    let updater = instance.updater;
    updater.prevProps = oldProps;
    updater.prevState = oldState;
    let propsChanged = oldProps !== newProps;
    let contextChanged = instance.context !== newContext;
    fiber.setout = true;

    if (!instance.__useNewHooks) {
        if (propsChanged || contextChanged) {
            // 如果 props 或者 context 改变了才会触发 cWRP
            let prevState = instance.state;
            callUnsafeHook(instance, "componentWillReceiveProps", [newProps, newContext]);
            if (prevState !== instance.state) {
                //模拟replaceState
                fiber.memoizedState = instance.state;
            }
        }
    }
    // 这是非队列更新的 state 赋值
    let newState = (instance.state = oldState);
    let updateQueue = fiber.updateQueue;
    mergeStates(fiber, newProps);
    newState = fiber.memoizedState;
    // 调用 setDrivedStateFromProps 并存储最新 state 在 fiber 的 memoizedState 上
    setStateByProps(instance, fiber, newProps, newState);
    newState = fiber.memoizedState;

    delete fiber.setout;
    fiber._hydrating = true;
    if (!propsChanged && newState === oldState && contextStack.length == 1 && !updateQueue.isForced) {
        fiber.updateFail = true;
    } else {
        let args = [newProps, newState, newContext];
        fiber.updateQueue = UpdateQueue();

        if (!updateQueue.isForced && !applyCallback(instance, "shouldComponentUpdate", args)) {
            fiber.updateFail = true;
        } else if (!instance.__useNewHooks) {
            callUnsafeHook(instance, "componentWillUpdate", args);
        }
    }
}

function callUnsafeHook(a, b, c) {
    applyCallback(a, b, c);
    applyCallback(a, "UNSAFE_" + b, c);
}

function isSameNode(a, b) {
    if (a.type === b.type && a.key === b.key) {
        return true;
    }
}

function setStateByProps(instance, fiber, nextProps, prevState) {
    // 新 api getDerivedStateFromProps
    fiber.errorHook = gDSFP;
    let fn = fiber.type[gDSFP];
    if (fn) {
        let partialState = fn.call(null, nextProps, prevState);
        if (typeNumber(partialState) === 8) {
            fiber.memoizedState = Object.assign({}, prevState, partialState);
        }
    }
}

function cloneChildren(fiber) {
    const prev = fiber.alternate;
    if (prev && prev.child) {
        let pc = prev.children;

        let cc = (fiber.children = {});
        fiber.child = prev.child;
        fiber.lastChild = prev.lastChild;
        for (let i in pc) {
            let a = pc[i];
            a.return = fiber; // 只改父引用不复制
            cc[i] = a;
        }
        setInsertPoints(cc);
    }
}
function cacheContext(instance, unmaskedContext, context) {
    instance.__unmaskedContext = unmaskedContext;
    instance.__maskedContext = context;
}
function getMaskedContext(instance, contextTypes, contextStack) {
    if (instance && !contextTypes) {
        return instance.context;
    }
    let context = {};
    if (!contextTypes) {
        return context;
    }

    let unmaskedContext = contextStack[0];
    if (instance) {
        var cachedUnmasked = instance.__unmaskedContext;
        if (cachedUnmasked === unmaskedContext) {
            return instance.__maskedContext;
        }
    }

    for (let key in contextTypes) {
        if (contextTypes.hasOwnProperty(key)) {
            context[key] = unmaskedContext[key];
        }
    }
    if (instance) {
        cacheContext(instance, unmaskedContext, context);
    }
    return context;
}

/**
 * 转换vnode为fiber
 * @param {Fiber} parentFiber
 * @param {Any} children => 这个是 vnode
 */
function diffChildren(parentFiber, children) {
    let oldFibers = parentFiber.children; // 旧的 di第一次没有 children
    if (oldFibers) {
        parentFiber.oldChildren = oldFibers;
    } else {
        oldFibers = {};
    }
    // parentFiber.children = {.0 ：children}
    // fiberizeChildren_ 把 fiber.children 由 旧的 变成 新的
    let newFibers = fiberizeChildren(children, parentFiber); // 新的
    let effects = parentFiber.effects || (parentFiber.effects = []);
    let matchFibers = new Object();
    delete parentFiber.child;
    for (let i in oldFibers) {
        let newFiber = newFibers[i];
        let oldFiber = oldFibers[i];
        // newFiber.type 是标签名 如 A， div 等
        // 所以 如果标签名没有改变， 这个循环干了点啥
        if (newFiber && newFiber.type === oldFiber.type) {
            matchFibers[i] = oldFiber;
            if (newFiber.key != null) {
                oldFiber.key = newFiber.key;
            }
            continue;
        }
        // 当标签名改变后调用函数
        detachFiber(oldFiber, effects);
    }

    let prevFiber,
        index = 0;
    for (let i in newFibers) {
        let newFiber = newFibers[i];
        let oldFiber = matchFibers[i];
        let alternate = null;
        if (oldFiber) {
            if (isSameNode(oldFiber, newFiber)) {
                //&& !oldFiber.disposed
                alternate = new Fiber(oldFiber);
                let oldRef = oldFiber.ref;
                // 合并 新旧
                newFiber = extend(oldFiber, newFiber);
                delete newFiber.disposed;
                newFiber.alternate = alternate;
                if (newFiber.ref && newFiber.deleteRef) {
                    delete newFiber.ref;
                    delete newFiber.deleteRef;
                }
                if (oldRef && oldRef !== newFiber.ref) {
                    //  alternate.effectTag *= NULLREF;
                    effects.push(alternate);
                }
                if (newFiber.tag === 5) {
                    newFiber.lastProps = alternate.props;
                }
            } else {
                detachFiber(oldFiber, effects);
            }
            // newFiber.effectTag = NOWORK;
        } else {
            // 根据 vnode 生成新的 fiber
            newFiber = new Fiber(newFiber);
        }
        // vnode 替换成 fiber
        newFibers[i] = newFiber;
        newFiber.index = index++;
        newFiber.return = parentFiber;
        // 在这里处理 fiber 树之间的关系
        if (prevFiber) {
            // 上个 fiber 的 sibling 就是 下个 fiber 是当前 fiber
            prevFiber.sibling = newFiber;
            // 当前 fiber 的 forward 就是 上个 fiber 是上个 fiber
            newFiber.forward = prevFiber;
        } else {
            // child 是 parentFiber 下的第一个 子fiber
            parentFiber.child = newFiber;
            // forward 上一个 fiber 同级
            newFiber.forward = null;
        }
        prevFiber = newFiber;
    }
    // 父 fiber 的 lastChild 是当前 fiber
    parentFiber.lastChild = prevFiber;
    if (prevFiber) {
        // sibling 下一个 fiber 同级的
        prevFiber.sibling = null;
    }
}
