const network = $;

const URL = "";

const ThunkCallBack = fn => {
    return function() {
        const arg = [...arguments];
        return function(cb) {
            let cbFinish = false;
            arg.push(function() {
                if (cbFinish) return;
                cb(...arguments);
                cbFinish = true;
            });
            fn(...arg);
        };
    };
};

const ThunkPromise = fn => {
    return function() {
        const arg = [...arguments];
        return function(cb) {
            let cbFinish = false;
            fn(...arg).then(function() {
                if (cbFinish) return;
                cb(...arguments);
                cbFinish = true;
            });
        };
    };
};

function ajax(url, cb) {
    network.get(url, cb, "jsonp");
}

function promiseAjax(url) {
    return new Promise((resolve, rej) => {
        network.get(
            url,
            function(res) {
                resolve(res);
            },
            "jsonp"
        );
    });
}

const thunkAjax = ThunkCallBack(ajax);

const thunkProAjax = ThunkPromise(promiseAjax);

function* ThunkCallBackGen() {
    const res = yield thunkAjax(URL);
    console.log(res);
    const ress = yield thunkAjax(URL);
    console.log(ress);
}

function* ThunkPromiseGen() {
    const res = yield thunkProAjax(URL);
    console.log(res);
    const ress = yield thunkProAjax(URL);
    console.log(ress);
}

// const io = ThunkCallBackGen();

// const i1 = io.next().value(function (res) {
//     i2 = io.next(res)
//     if (i2.done) {
//         return
//     }
//     i2.value(function(res) {

//     })
// });

function* test() {
    var a = yield function() {
        return 1 + 2;
    };
    console.log(a);
}

function run(fn) {
    const io = fn();
    function next(data) {
        const i1 = io.next(data);
        if (i1.done) return;
        i1.value(next);
    }
    next();
}

// run(ThunkCallBackGen)
// run(ThunkPromiseGen)

//  co
function co(generation) {
    const gen = generation();
    function next(res) {
        const nextObj = gen.next(res);
        then(nextObj);
    }
    function then(nextObj) {
        if (nextObj.done) return;
        nextObj.value.then(next);
    }
    next();
}

co(function*() {
    const res = yield promiseAjax(URL);
    console.log(res);
    const ress = yield promiseAjax(URL);
    console.log(ress);
});
