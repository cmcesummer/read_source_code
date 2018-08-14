import { h, render, Component } from "preact";

class A extends Component {
    state = {
        context: "MESSAGE"
    };
    componentDidMount() {
        console.log(<B />);
        console.log(this.props.name);
    }
    onClick = () => {
        this.setState({
            context: "MESSAGE_MESSAGE"
        });
    };
    render() {
        return (
            <div id="foo">
                <B />
                <button onClick={this.onClick}>
                    <span>___</span>{" "}
                </button>
                <div>{this.state.context}</div>
            </div>
        );
    }
}

class B extends Component {
    render() {
        return (
            <div>
                <span>MESSAGE_MESSAGE</span>
            </div>
        );
    }
}

render(<A name="ACOMPONENT" />, document.querySelector("#root"));
