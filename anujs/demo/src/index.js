import React, { Component } from "react";
import ReactDOM from "react-dom";

class A extends Component {
    state = {
        context: "MESSAGE"
    };
    componentDidMount() {
        // console.log(<B />);
        console.log(this.props.name);
    }
    onClick = () => {
        this.setState({
            context: "MESSAGE_MESSAGE"
        });
    };
    render() {
        return <div id="foo">{this.state.context}</div>;
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
