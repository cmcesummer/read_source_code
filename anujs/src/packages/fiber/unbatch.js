import { miniCreateClass } from "react-core/util";
import { Component } from "react-core/Component";

// 作用是 Unbatch 继承 Component, 并用 render 方法覆盖自己的 render 方法，
// 最后返回的是 Unbatch 这个继承并且合并好的类

export var Unbatch = miniCreateClass(
    function Unbatch(props) {
        this.state = {
            child: props.child
        };
    },
    Component,
    {
        render() {
            // Unbatch 的 render 是 App vnode
            return this.state.child;
        }
    }
);
