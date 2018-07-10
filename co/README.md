# co

tj的`co`库实现解决异步的问题是通过 `Generator生成器`。   
下面是核心代码。。 我理解的核心。  
```javascript
function co (generator) {
    // 先运行传入的generator 获得指针
    const gen = generator();

    function next(res) {
        // 运行 next(), 移动指针到 遇到的 yield
        const g1 = gen.next(res)
        // yield 后是 promise , 所以接下来调用then方法
        then(g1)
    }

    function then(g1) {
        // 如果结束就不再继续  在co中是返回的promise
        if(g1.done) return 
        // g1.value 是一个promise 再把next当做then中的函数传入
        g1.value.then(next)
    }

    next();
}
```
使用  
```javascript
co(function* () {
    const res1 = yield promise('url');
    console.log(res1);
    const res2 = yield promise('url');
    console.log(res2);
})
```
co不仅支持promise, 还支持 thunkFunction 等。   
关于 thunkFunction 看一下 同级目录下的 `index.js` 文件： [index.js](https://github.com/cmcesummer/read_source_code/blob/master/co/index.js)   

当然 co 也有很多不足跟 `async/await` 比起来，比如`yield`后面不能跟普通函数之类的，而`await`均可以。  
现在都2018年了，直接用 `async/await`吧。我看 co 源码纯粹是看看怎么实现的，用的话当然是选择已经提上规范的 async 了。

