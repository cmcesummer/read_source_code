import React, { Component } from "react";
import ReactDOM from "react-dom";

class A extends Component {
    state = {
        context: "2"
    };
    componentDidMount() {
        // console.log(<B />);
        console.log(this.props.name);
        // setTimeout(() => {
        //     this.setState({ time: 3 });
        //     console.log(this.state.time);
        // }, 10000);
    }
    onClick = () => {
        this.setState({
            contexts: "2323"
        });
    };
    
    static getDerivedStateFromProps(p, s) {
        console.log(p, s);
        if(p.name == s.context) {
            return {
                context: '222'
            }
        } else {
            return {
                context: p.name
            }
        }
    }
    render() {
        return (
            <div id="foo" onClick={this.onClick}>
                {this.state.context}
            </div>
        );
    }
}

/*
<B />
                <button onClick={this.onClick}>
                    <span>___</span>{" "}
                </button>
                <div>{this.state.context}</div>
*/

class B extends Component {
    render() {
        return (
            <div>
                <span>MESSAGE_MESSAGE</span>
            </div>
        );
    }
}

ReactDOM.render(<A name="ACOMPONENT" />, document.querySelector("#root"));
