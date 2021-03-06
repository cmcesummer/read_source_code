import { SYNC_RENDER, NO_RENDER, FORCE_RENDER, ASYNC_RENDER, ATTR_KEY } from "../constants";
import options from "../options";
import { extend } from "../util";
import { enqueueRender } from "../render-queue";
import { getNodeProps } from "./index";
import { diff, mounts, diffLevel, flushMounts, recollectNodeTree, removeChildren } from "./diff";
import { createComponent, collectComponent } from "./component-recycler";
import { removeNode } from "../dom/index";

/**
 * Set a component's `props` and possibly re-render the component
 * @param {import('../component').Component} component The Component to set props on
 * @param {object} props The new props
 * @param {number} renderMode Render options - specifies how to re-render the component
 * @param {object} context The new context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 */
// 果然只是 设置props context
export function setComponentProps(component, props, renderMode, context, mountAll) {
	// cols, props, 1, {}, false
	if (component._disable) return;
	component._disable = true;

	component.__ref = props.ref;
	component.__key = props.key;
	delete props.ref;
	delete props.key;
	// 卧槽 强啊， 这都跟上 最新的api了
	if (typeof component.constructor.getDerivedStateFromProps === "undefined") {
		// 生命周期
		if (!component.base || mountAll) {
			// 第一次渲染的时候走这里
			if (component.componentWillMount) component.componentWillMount();
		} else if (component.componentWillReceiveProps) {
			component.componentWillReceiveProps(props, context);
		}
	}

	if (context && context !== component.context) {
		// 这里是 context 改变后
		// 添加了 prevContext 后期是不是要删除
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}
	// 赋值上一个 props  但是我有个疑问， 这里赋值是赋值的指针啊，props 必然是个 object
	// -------------------   解释上边那个疑问， 这里没问题！！！ 这里是两个不同的 obj, 而不是在原指针上修改
	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (renderMode !== NO_RENDER) {
		// 首次render 1 !== 0
		if (renderMode === SYNC_RENDER || options.syncComponentUpdates !== false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		} else {
			enqueueRender(component);
		}
	}

	if (component.__ref) component.__ref(component);
}

/**
 * Render a Component, triggering necessary lifecycle events and taking
 * High-Order Components into account.
 * @param {import('../component').Component} component The component to render
 * @param {number} [renderMode] render mode, see constants.js for available options.
 * @param {boolean} [mountAll] Whether or not to immediately mount all components
 * @param {boolean} [isChild] ?
 * @private
 */
export function renderComponent(component, renderMode, mountAll, isChild) {
	// 首次 ： component实例， 1， false
	if (component._disable) return;

	let props = component.props,
		state = component.state,
		context = component.context,
		previousProps = component.prevProps || props,
		previousState = component.prevState || state,
		previousContext = component.prevContext || context,
		isUpdate = component.base,
		nextBase = component.nextBase,
		initialBase = isUpdate || nextBase,
		initialChildComponent = component._component,
		skip = false,
		snapshot = previousContext,
		rendered,
		inst,
		cbase;

	if (component.constructor.getDerivedStateFromProps) {
		// 这个是正常的， 这样才能赋值嘛 previousState 保存着上个状态的 state
		previousState = extend({}, previousState);
		component.state = extend(state, component.constructor.getDerivedStateFromProps(props, state));
	}

	// if updating
	// 第一次这里应该是 false
	if (isUpdate) {
		// 这个的意义是绑定上个状态到当前对象上，在 shouldComponentUpdate 等生命周期中可以使用this.state获取到正确值
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (
			renderMode !== FORCE_RENDER &&
			component.shouldComponentUpdate &&
			component.shouldComponentUpdate(props, state, context) === false
		) {
			skip = true;
		} else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	//
	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		if (isUpdate && component.getSnapshotBeforeUpdate) {
			snapshot = component.getSnapshotBeforeUpdate(previousProps, previousState);
		}

		let childComponent = rendered && rendered.nodeName,
			toUnmount,
			base;

		if (typeof childComponent === "function") {
			// set up high order component link

			let childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			} else {
				toUnmount = inst;

				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		} else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || renderMode === SYNC_RENDER) {
				if (cbase) cbase._component = null;
				// undefined, {nodeName: 'div', attr...}, {}, true, false, true
				base = diff(
					cbase,
					rendered,
					context,
					mountAll || !isUpdate,
					initialBase && initialBase.parentNode,
					true
				);
			}
		}

		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base !== baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
				t = component;
			while ((t = t._parentComponent)) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	} else if (!skip) {
		// Ensure that pending componentDidMount() hooks of child components
		// are called before the componentDidUpdate() hook in the parent.
		// Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
		// flushMounts();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, snapshot);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);

	if (!diffLevel && !isChild) flushMounts();
}

/**
 * Apply the Component referenced by a VNode to the DOM.
 * 将VNode引用的Component应用于DOM。
 * @param {import('../dom').PreactElement} dom The DOM node to mutate
 * @param {import('../vnode').VNode} vnode A Component-referencing VNode
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @returns {import('../dom').PreactElement} The created/mutated element
 * @private
 */
export function buildComponentFromVNode(dom, vnode, context, mountAll) {
	// dom = undefined  mountAll = false  context = {}
	let c = dom && dom._component, // c = undefined
		originalComponent = c,
		oldDom = dom,
		isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
		isOwner = isDirectOwner,
		// 得到 attrbitue + children  并 defaultProps 赋值  => props = { ...attribute , children}
		props = getNodeProps(vnode);

	// 第一次 render 时 false
	while (c && !isOwner && (c = c._parentComponent)) {
		isOwner = c.constructor === vnode.nodeName;
	}
	// 第一次 render 时 false
	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	} else {
		// originalComponent = undefined
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}

		// c 是 component 类的一个实例
		c = createComponent(vnode.nodeName, props, context);
		// 第一次 dom 不存在
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			oldDom = null;
		}
		// cols, props, 1, {}, false
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom !== oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}

/**
 * Remove a component from the DOM and recycle it.
 * @param {import('../component').Component} component The Component instance to unmount
 * @private
 */
export function unmountComponent(component) {
	if (options.beforeUnmount) options.beforeUnmount(component);

	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	} else if (base) {
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

		component.nextBase = base;

		removeNode(base);
		collectComponent(component);

		removeChildren(base);
	}

	if (component.__ref) component.__ref(null);
}
