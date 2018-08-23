import options from "./options";
import { defer } from "./util";
import { renderComponent } from "./vdom/component";

/**
 * Managed queue of dirty components to be re-rendered
 * @type {Array<import('./component').Component>}
 */
// 重新渲染的组件列表
let items = [];

/**
 * Enqueue a rerender of a component
 * @param {import('./component').Component} component The component to rerender
 */
export function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
		// 这里使用 defer 是为了把多个state更改放到一起去更新  
		// items.push(component) == 1  第二次 setState就不走render了，上面的判断条件为 false
		(options.debounceRendering || defer)(rerender);
	}
}

/** Rerender all enqueued dirty components */
export function rerender() {
	let p,
		list = items;
	items = [];
	while ((p = list.pop())) {
		if (p._dirty) renderComponent(p);
	}
}
