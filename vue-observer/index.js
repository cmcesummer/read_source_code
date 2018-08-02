// 大概了解一下这种监听方式 也是观察者的一种

class MVVM {
    constructor(data) {
        this.data = data;
        this.target = null;
        this.setProperty();
        this.complier();
    }

    setProperty() {
        const context = this;
        for (let key in this.data) {
            let value = this.data[key];
            const dep = new dep();
            Object.defineProperty(this.data, key, {
                set(newValue) {
                    if (value === newValue) return
                    value = newValue;
                    // 当值改变时执行该队列
                    dep.fire(value);
                },
                get() {
                    // 添加订阅
                    // context.target = new Watch({ value, type: 'text' });
                    if (context.target) dep.add(context.target);
                    return value
                }
            })
        }
    }

    complier() {
        // ... 遍历之类的  因为是循环， 所以每次都会绑定结束后再绑下一个
        let node = {};
        if (node.type === 'text') {
            // 这里绑定 watch 实例到 target
            this.target = new Watch({ type: 'text', node });
            // 这里出发 get ， 拿到 target ,添加到队列中 
            this.node.nodeValue = this.data[node.value];
            // 接触绑定， 防止不停的调用 get, 添加队列 
            this.target = null;
        }
    }
}

class Dep {
    listen = [];
    add(fn) {
        if (fn && !this.listen.includes(fn)) {
            this.listen.push(fn);
        }
    }
    fire(value) {
        this.listen.forEach(item => item.update(value))
    }
}

// watch 就是一个执行具体逻辑函数
class Watch {
    constructor({ type, node }) {
        this.type = type;
        this.node = node;
    }
    update(value) {
        if (this.type === 'text') {
            this.node.nodeValue = value;
        }
    }
}