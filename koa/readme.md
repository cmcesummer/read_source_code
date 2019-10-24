# koa 总结

```js
const compose = arr => {
    return ctx => {
        function dispatch(i) {
            const fn = arr[i];
            if (!fn) return Promise.resolve();
            return Promise.resolve(fn(ctx, dispatch.bind(null, i + 1)));
        }
        return dispatch(0);
    };
};
```

#### koa 大致模型

```js
const fnArray = [];
fnArray.push((ctx: any, next: any) => {
    console.log(1);
    ctx.req = 2;
    next();
    console.log(2);
});
fnArray.push((ctx: any, next: any) => {
    console.log(3);
    next();
    console.log(4);
    ctx.body = "456789";
});
const fnMiddle = Utils.compose(fnArray);
const ctxs: any = {
    res: {
        end: (text: any) => {
            console.log(`out ${text}`);
        }
    }
};
fnMiddle(ctxs).then(() => {
    return ctxs.res.end(ctxs.body);
});
```

### 返回的形式

使用的是 `res.end(JSON.stringify(object))`,
