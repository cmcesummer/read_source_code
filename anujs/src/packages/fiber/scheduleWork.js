import { reconcileDFS } from "./beginWork";
import { commitDFS } from "./commitWork";
import { Renderer } from "react-core/createRenderer";
import { effects, isMounted, resetStack, arrayPush, get, isFn, topNodes, typeNumber, topFibers } from "react-core/util";
import { Unbatch } from "./unbatch";
import { Fiber } from "./Fiber";

import { createInstance } from "./createInstance";
const macrotasks = Renderer.macrotasks;
let boundaries = Renderer.boundaries;
const batchedtasks = [];

export function render(vnode, root, callback) {
    // container 是 root 产生的一个 fiber;
    let container = createContainer(root),
        immediateUpdate = false;
    if (!container.hostRoot) {
        // render要跑起来，需要一个组件，
        // 因此React.render(vdom, container, cb)中的前两个参数间会嵌入一个内置组件Unbatch
        let fiber = new Fiber({
            type: Unbatch,
            tag: 2,
            props: {},
            hasMounted: true,
            memoizedState: {},
            return: container
        });
        fiber.index = 0;
        container.child = fiber;
        //将 updateClassComponent 部分逻辑放到这里，我们只需要实例化它
        let instance = createInstance(fiber, {});
        container.hostRoot = instance;
        immediateUpdate = true;
        // 清空 container.stateNode 节点的内容
        Renderer.emptyElement(container);
    }
    let carrier = {};
    updateComponent(
        container.hostRoot,
        {
            child: vnode
        },
        wrapCb(callback, carrier),
        immediateUpdate
    );

    return carrier.instance;
}

function wrapCb(fn, carrier) {
    return function() {
        let fiber = get(this);
        let target = fiber.child ? fiber.child.stateNode : null;
        fn && fn.call(target);
        carrier.instance = target;
    };
}
// performWork_ 会像经典 rAF 动画那样递归调整自身，直到耗尽 macrotasks 里面的任务.
function performWork(deadline) {
    // 更新虚拟DOM与真实环境
    // 用于执行 macrotasks 与 micotasks 里面的任务。
    workLoop(deadline);
    //如果更新过程中产生新的任务（setState与gDSFP），它们会放到每棵树的microtasks
    //我们需要再做一次收集，不为空时，递归调用

    if (boundaries.length) {
        //优先处理异常边界的setState
        macrotasks.unshift.apply(macrotasks, boundaries);
        boundaries.length = 0;
    }

    topFibers.forEach(function(el) {
        let microtasks = el.microtasks;
        while ((el = microtasks.shift())) {
            if (!el.disposed) {
                macrotasks.push(el);
            }
        }
    });
    if (macrotasks.length) {
        requestIdleCallback(performWork);
    }
}

let ENOUGH_TIME = 1;
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

let isBatching = false;

// 批量更新 也就是触发 diff 再 渲染
// 这个在 事件系统 里被调用。 事件机制
// workLoop_ 的最后 commitDFS_ 里也会调用该函数
Renderer.batchedUpdates = function(callback, event) {
    let keepbook = isBatching;
    // 批量的状态 只有在这里的时候才归到批量设置state中
    // 这里也是为什么 serState 是部分情况下异步的原因：
    //     在生命周期中 和 react自定义事件中， 都会走callback,
    isBatching = true;
    try {
        event && Renderer.fireMiddlewares(true);
        return callback(event);
    } finally {
        // 真正的批量更新在这里， 上边是一起设置状态， 这里是diff
        isBatching = keepbook;
        if (!isBatching) {
            let el;
            while ((el = batchedtasks.shift())) {
                if (!el.disabled) {
                    macrotasks.push(el);
                }
            }
            event && Renderer.fireMiddlewares();
            // performWork_
            // 只在两个地方调用 一个是这个函数  还一个是  updateComponent_ 函数
            Renderer.scheduleWork();
        }
    }
};

function workLoop(deadline) {
    let fiber = macrotasks.shift(),
        // 第一次 fiber 是那个 unbatch 的 fiber
        info;
    if (fiber) {
        if (fiber.type === Unbatch) {
            info = fiber.return;
            // info = container 的 fiber
        } else {
            let dom = getContainer(fiber);
            info = {
                containerStack: [dom],
                contextStack: [fiber.stateNode.__unmaskedContext]
            };
        }

        // 深度优先的 结束; 更新 vdom
        reconcileDFS(fiber, info, deadline, ENOUGH_TIME);
        // 深度优先结束后开始 更新 dom
        updateCommitQueue(fiber);
        // 保留 info 中 containerStack 和 contextStack 数组的最后一项
        resetStack(info);
        if (macrotasks.length && deadline.timeRemaining() > ENOUGH_TIME) {
            workLoop(deadline); //收集任务
        } else {
            commitDFS(effects); //执行任务
        }
    }
}

// 干了点啥? 就把 fiber push 到 effects ?
function updateCommitQueue(fiber) {
    // 这里的 fiber 是更新后的 fiber
    var hasBoundary = boundaries.length;
    if (fiber.type !== Unbatch) {
        //如果是某个组件更新
        if (hasBoundary) {
            //如果在reconcile阶段发生异常，那么commit阶段就不会从原先的topFiber出发，而是以边界组件的alternate出发
            arrayPush.apply(effects, boundaries);
        } else {
            effects.push(fiber);
        }
    } else {
        // 是一个全局数组
        effects.push(fiber);
    }
    boundaries.length = 0;
}

/**
 * 这是一个深度优先过程，beginWork之后，对其孩子进行任务收集，然后再对其兄弟进行类似操作，
 * 没有，则找其父节点的孩子
 * @param {Fiber} fiber
 * @param {Fiber} topWork
 */

function mergeUpdates(fiber, state, isForced, callback) {
    let updateQueue = fiber.updateQueue;
    if (isForced) {
        updateQueue.isForced = true; // 如果是true就变不回false
    }
    if (state) {
        updateQueue.pendingStates.push(state);
    }
    if (isFn(callback)) {
        updateQueue.pendingCbs.push(callback);
    }
}

function fiberContains(p, son) {
    while (son.return) {
        if (son.return === p) {
            return true;
        }
        son = son.return;
    }
}

function getQueue(fiber) {
    while (fiber) {
        if (fiber.microtasks) {
            return fiber.microtasks;
        }
        fiber = fiber.return;
    }
}

function pushChildQueue(fiber, queue) {
    //判定当前节点是否包含已进队的节点
    let maps = {};
    for (let i = queue.length, el; (el = queue[--i]); ) {
        //移除列队中比它小的组件
        if (fiber === el) {
            queue.splice(i, 1); //已经放进过，去掉
            continue;
        } else if (fiberContains(fiber, el)) {
            //不包含自身
            queue.splice(i, 1);
            continue;
        }
        maps[el.stateNode.updater.mountOrder] = true;
    }
    let enqueue = true,
        p = fiber,
        hackSCU = [];
    while (p.return) {
        p = p.return;
        var instance = p.stateNode;
        if (instance.refs && !instance.__isStateless && p.type !== Unbatch) {
            hackSCU.push(p);
            var u = instance.updater;
            if (maps[u.mountOrder]) {
                //它是已经在列队的某个组件的孩子
                enqueue = false;
                break;
            }
        }
    }
    hackSCU.forEach(function(el) {
        //如果是批量更新，必须强制更新，防止进入SCU
        el.updateQueue.batching = true;
    });
    if (enqueue) {
        queue.push(fiber);
    }
}
//setState的实现
// 调用 setState 时的参数是 当前的组件实例， 新的state
function updateComponent(instance, state, callback, immediateUpdate) {
    // get 获取的是 挂在实例上的_reactInternalFiber属性： fiber 对象
    let fiber = get(instance);
    // 把当前组件标记为 dirty
    fiber.dirty = true;

    // Object typeNumber = 8
    let sn = typeNumber(state);
    let isForced = state === true;
    // 获取当前的 fiber 树上的 微任务
    let microtasks = getQueue(fiber);

    state = isForced ? null : sn === 5 || sn === 8 ? state : null;
    // fiber.setout_在beginWork中设置的
    if (fiber.setout) {
        // cWM/cWRP中setState， 不放进列队  也就是 componentWillMount、componentWillUpdate 和 componentWillReceiveProps 中设置 fiber.setout_ = true
        immediateUpdate = false;
    } else if ((isBatching && !immediateUpdate) || fiber._hydrating) {
        // 这里 isBatching_ 是true 是因为这是事件触发的，在 dom/event.js 中 dispatchEvent_ 触发， 然后走的 Renderer.batchedUpdates_
        // 事件回调，batchedUpdates, 错误边界, cDM/cDU中setState
        //  ---------------------   这里有疑问 batchedtasks_ 是如何突然多了的?????????
        // ----------------------   在 pushChildQueue 中把 fiber push 进去的
        // 这里干了点啥？ refs? fiber 还是那个 fiber
        pushChildQueue(fiber, batchedtasks);
    } else {
        //情况4，在钩子外setState或batchedUpdates中ReactDOM.render一棵新树
        immediateUpdate = immediateUpdate || !fiber._hydrating;
        pushChildQueue(fiber, microtasks);
    }
    // 第一次render： fiber（unbatch的fiber）的updateQueue.pendingStates和pendingCbs都有state cbs
    // 这里先把最新的 state push 到队列里  `updateQueue.pendingStates`， 等 Renderer.scheduleWork 的时候再更新赋值
    // 然后再 applybeforeUpdateHooks  applybeforeMountHooks 中合并 
    //  ---------  需要看看 什么时候调用更新的这个函数 =>  
    //  Renderer.scheduleWork => workLoop => reconcileDFS => updateClassComponent => applybeforeUpdateHooks
    mergeUpdates(fiber, state, isForced, callback);
    // 上边的方法 把 state 和 cb放到了 fiber.updateQueue 中的 pendingStates / pendingCbs
    // 所以说在 事件系统中改变state 这个函数的作用 只是 pushChildQueue 和 mergeUpdates 么
    // 当在 setState 调用时，immediateUpdate 这个参数是不传的，所以不走这个 Renderer.scheduleWork，
    // 而是在 batchedUpdates 中 走 catch 内的 Renderer.scheduleWork，
    // ----------------
    // 在 生命周期 和 react自定义事件中触发的 setState, 走 Renderer.batchedUpdates 堆栈，然后设置 isBatching = true,
    // 当不在上述情况下调用 setState 时， isBatching = false,  immediateUpdate = immediateUpdate || !fiber._hydrating; 这时是true
    if (immediateUpdate) {
        // DFS
        Renderer.scheduleWork();
    }
}

Renderer.updateComponent = updateComponent;

function validateTag(el) {
    return el && el.appendChild;
}
export function createContainer(root, onlyGet, validate) {
    validate = validate || validateTag;
    if (!validate(root)) {
        throw `container is not a element`; // eslint-disable-line
    }

    root.anuProp = 2018;
    let useProp = root.anuProp === 2018;
    //像IE6-8，文本节点不能添加属性
    if (useProp) {
        root.anuProp = void 0;
        // get () => key._reactInternalFiber
        if (get(root)) {
            return get(root);
        }
    } else {
        let index = topNodes.indexOf(root);
        if (index !== -1) {
            return topFibers[index];
        }
    }
    if (onlyGet) {
        return null;
    }
    let container = new Fiber({
        stateNode: root,
        // 顶部根节点的 tag 为5
        tag: 5,
        name: "hostRoot",
        //contextStack的对象 总是它的后面的元素的并集 ［dUcUbUa, cUbUa, bUa, a, {}］
        contextStack: [{}],
        containerStack: [root],
        microtasks: [],
        type: root.nodeName || root.type
    });
    if (useProp) {
        root._reactInternalFiber = container;
    }
    topNodes.push(root);
    topFibers.push(container);

    return container;
}

export function getContainer(p) {
    if (p.parent) {
        return p.parent;
    }
    while ((p = p.return)) {
        if (p.tag === 5) {
            return p.stateNode;
        }
    }
}
