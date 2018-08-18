import { ATTR_KEY } from "../constants";
import { isSameNodeType, isNamedNode } from "./index";
import { buildComponentFromVNode } from "./component";
import { createNode, setAccessor } from "../dom/index";
import { unmountComponent } from "./component";
import options from "../options";
import { removeNode } from "../dom/index";

/**
 * Queue of components that have been mounted and are awaiting componentDidMount
 * @type {Array<import('../component').Component>}
 */
// 用来render完后 调用 生命周期的暂存栈
export const mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
/** Diff递归计数，用于跟踪diff周期的结束。 */
export let diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
let isSvgMode = false;

/** Global flag indicating if the diff is performing hydration */
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
export function flushMounts() {
    let c;
    while ((c = mounts.pop())) {
        if (options.afterMount) options.afterMount(c);
        if (c.componentDidMount) c.componentDidMount();
    }
}

/**
 * Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 * @param {import('../dom').PreactElement} dom A DOM node to mutate into the shape of a `vnode`
 * @param {import('../vnode').VNode} vnode A VNode (with descendants forming a tree) representing
 *  the desired DOM structure
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {Element} parent ?
 * @param {boolean} componentRoot ?
 * @returns {import('../dom').PreactElement} The created/mutated element
 * @private
 */
// render 调用的就是这个 diff ;
export function diff(dom, vnode, context, mountAll, parent, componentRoot) {
    // 初始化参数 diff(undefined, Component, {}, false, document.body, false);
    // 在这里 diff 的层级是 0
    // diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
    // 初始化调用变为 1
    // 第二次
    if (!diffLevel++) {
        // 第一次调用执行
        // when first starting the diff, check if we're diffing an SVG or within an SVG
        // 判断 parent 是 svg
        isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

        // hydration is indicated by the existing element to be diffed not having a prop cache
        hydrating = dom != null && !(ATTR_KEY in dom);
    }

    // 产生真实 DOM
    let ret = idiff(dom, vnode, context, mountAll, componentRoot);

    // append the element if its a new parent
    // 添加到页面中去
    if (parent && ret.parentNode !== parent) parent.appendChild(ret);

    // diffLevel being reduced to 0 means we're exiting the diff
    if (!--diffLevel) {
        hydrating = false;
        // invoke queued componentDidMount lifecycle methods
        if (!componentRoot) flushMounts();
    }

    return ret;
}

/**
 * Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing.
 * @param {import('../dom').PreactElement} dom A DOM node to mutate into the shape of a `vnode`
 * @param {import('../vnode').VNode} vnode A VNode (with descendants forming a tree) representing the desired DOM structure
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {boolean} [componentRoot] ?
 * @private
 */
function idiff(dom, vnode, context, mountAll, componentRoot) {
    //undefined, {nodeName: 'div', attr...}, {}, true, false, true  第二次
    // undefined, Component, {}, false, false
    let out = dom,
        prevSvgMode = isSvgMode; // false

    // empty values (null, undefined, booleans) render as empty Text nodes
    if (vnode == null || typeof vnode === "boolean") vnode = "";

    // 正常来说是个对象 这里先不看
    // 这里是最内层了
    // Fast case: Strings & Numbers create/update Text nodes.
    if (typeof vnode === "string" || typeof vnode === "number") {
        // update if it's already a Text node:
        if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
            /* istanbul ignore if */ /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
            if (dom.nodeValue != vnode) {
                dom.nodeValue = vnode;
            }
        } else {
            // it wasn't a Text node: replace it with one and recycle the old Element
            out = document.createTextNode(vnode);
            if (dom) {
                if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
                recollectNodeTree(dom, true);
            }
        }

        out[ATTR_KEY] = true;

        return out;
    }

    // If the VNode represents a Component, perform a component diff:
    // nodeName 此时是 function 就是组件的那个 function
    // 第二次这里是 string : 'div'
    let vnodeName = vnode.nodeName;
    if (typeof vnodeName === "function") {
        // 渲染组件的时候只有 vnode 是 Component
        // 直接返回该方法   参数：  undefined, Component, {}, false
        return buildComponentFromVNode(dom, vnode, context, mountAll);
    }

    // Tracks entering and exiting SVG namespace when descending through the tree.
    isSvgMode = vnodeName === "svg" ? true : vnodeName === "foreignObject" ? false : isSvgMode;

    // If there's no existing element or it's the wrong type, create a new one:
    vnodeName = String(vnodeName);
    // 如果是第一次渲染 或者 后来重绘时的 dom 与 当前 vnodeName 不同
    if (!dom || !isNamedNode(dom, vnodeName)) {
        // createNode:   document.createElement(vnodeName)
        out = createNode(vnodeName, isSvgMode);

        if (dom) {
            // move children into the replacement node
            while (dom.firstChild) out.appendChild(dom.firstChild);

            // if the previous Element was mounted into the DOM, replace it inline
            if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

            // recycle the old element (skips non-Element node types)
            recollectNodeTree(dom, true);
        }
    }

    let fc = out.firstChild,
        // ATTR_KEY = __preactattr_
        props = out[ATTR_KEY],
        vchildren = vnode.children;

    if (props == null) {
        // 初始化赋值
        props = out[ATTR_KEY] = {};
        for (let a = out.attributes, i = a.length; i--;) props[a[i].name] = a[i].value;
    }

    // Optimization: fast-path for elements containing a single TextNode:
    if (
        !hydrating &&
        vchildren &&
        vchildren.length === 1 &&
        typeof vchildren[0] === "string" &&
        fc != null &&
        fc.splitText !== undefined &&
        fc.nextSibling == null
    ) {
        if (fc.nodeValue != vchildren[0]) {
            fc.nodeValue = vchildren[0];
        }
    }
    // otherwise, if there are existing or new children, diff them:
    else if ((vchildren && vchildren.length) || fc != null) {
        innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
    }

    // Apply attributes/props from VNode to the DOM Element:
    diffAttributes(out, vnode.attributes, props);

    // restore previous SVG mode: (in case we're exiting an SVG namespace)
    isSvgMode = prevSvgMode;

    return out;
}

/**
 * Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 * @param {import('../dom').PreactElement} dom Element whose children should be compared & mutated
 * @param {Array<import('../vnode').VNode>} vchildren Array of VNodes to compare to `dom.childNodes`
 * @param {object} context Implicitly descendant context object (from most
 *  recent `getChildContext()`)
 * @param {boolean} mountAll Whether or not to immediately mount all components 是否立即安装所有组件
 * @param {boolean} isHydrating if `true`, consumes externally created elements
 *  similar to hydration
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
    let originalChildren = dom.childNodes,
        children = [],
        keyed = {},
        keyedLen = 0,
        min = 0,
        len = originalChildren.length,
        childrenLen = 0,
        vlen = vchildren ? vchildren.length : 0,
        j,
        c,
        f,
        vchild,
        child;

    // Build up a map of keyed children and an Array of unkeyed children:
    // 第一次这里 == 0
    if (len !== 0) {
        for (let i = 0; i < len; i++) {
            let child = originalChildren[i],
                props = child[ATTR_KEY],
                key = vlen && props ? (child._component ? child._component.__key : props.key) : null;
            if (key != null) {
                keyedLen++;
                keyed[key] = child;
            } else if (
                props ||
                (child.splitText !== undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)
            ) {
                children[childrenLen++] = child;
            }
        }
    }

    if (vlen !== 0) {
        for (let i = 0; i < vlen; i++) {
            vchild = vchildren[i];
            child = null;

            // attempt to find a node based on key matching
            let key = vchild.key;
            if (key != null) {
                if (keyedLen && keyed[key] !== undefined) {
                    child = keyed[key];
                    keyed[key] = undefined;
                    keyedLen--;
                }
            }
            // attempt to pluck a node of the same type from the existing children
            else if (min < childrenLen) {
                for (j = min; j < childrenLen; j++) {
                    if (children[j] !== undefined && isSameNodeType((c = children[j]), vchild, isHydrating)) {
                        child = c;
                        children[j] = undefined;
                        if (j === childrenLen - 1) childrenLen--;
                        if (j === min) min++;
                        break;
                    }
                }
            }

            // morph the matched/found/created DOM child to match vchild (deep)
            child = idiff(child, vchild, context, mountAll);

            f = originalChildren[i];
            if (child && child !== dom && child !== f) {
                if (f == null) {
                    dom.appendChild(child);
                } else if (child === f.nextSibling) {
                    removeNode(f);
                } else {
                    dom.insertBefore(child, f);
                }
            }
        }
    }

    // remove unused keyed children:
    if (keyedLen) {
        for (let i in keyed) if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
    }

    // remove orphaned unkeyed children:
    while (min <= childrenLen) {
        if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
    }
}

/**
 * Recursively recycle (or just unmount) a node and its descendants.
 * @param {import('../dom').PreactElement} node DOM node to start
 *  unmount/removal from
 * @param {boolean} [unmountOnly=false] If `true`, only triggers unmount
 *  lifecycle, skips removal
 */
export function recollectNodeTree(node, unmountOnly) {
    let component = node._component;
    if (component) {
        // if node is owned by a Component, unmount that component (ends up recursing back here)
        unmountComponent(component);
    } else {
        // If the node's VNode had a ref function, invoke it with null here.
        // (this is part of the React spec, and smart for unsetting references)
        // 当卸载时 这里处理了 ref 的内存，不用担心泄露
        if (node[ATTR_KEY] != null && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);

        if (unmountOnly === false || node[ATTR_KEY] == null) {
            removeNode(node);
        }

        removeChildren(node);
    }
}

/**
 * Recollect/unmount all children.
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
export function removeChildren(node) {
    node = node.lastChild;
    while (node) {
        let next = node.previousSibling;
        recollectNodeTree(node, true);
        node = next;
    }
}

/**
 * Apply differences in attributes from a VNode to the given DOM Element.
 * @param {import('../dom').PreactElement} dom Element with attributes to diff `attrs` against
 * @param {object} attrs The desired end-state key-value attribute pairs
 * @param {object} old Current/previous attributes (from previous VNode or
 *  element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
    let name;

    // remove attributes no longer present on the vnode by setting them to undefined
    for (name in old) {
        if (!(attrs && attrs[name] != null) && old[name] != null) {
            setAccessor(dom, name, old[name], (old[name] = undefined), isSvgMode);
        }
    }

    // add new & update changed attributes
    for (name in attrs) {
        if (
            name !== "children" &&
            name !== "innerHTML" &&
            (!(name in old) || attrs[name] !== (name === "value" || name === "checked" ? dom[name] : old[name]))
        ) {
            setAccessor(dom, name, old[name], (old[name] = attrs[name]), isSvgMode);
        }
    }
}
