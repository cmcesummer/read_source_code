import React, {Component} from 'react';
import StoreContext from './StoreContext';

export default function connect (mapStateToProps, mapDispatchToProps) {
    return function(BaseComponent) {
        return class Warp extends Component {
            render() {
                return (
                    <StoreContext.Consumer>
                        {value => {
                            const parProps = this.props;
                            return <WarpComponent $$REACT_STORE_CONTEXT_PROPS$$={{mapStateToProps, mapDispatchToProps, BaseComponent, value, parProps}}/>
                        }}
                    </StoreContext.Consumer>
                )
            }
        }
    }
}

class WarpComponent extends Component {
    constructor(prop) {
        super(prop);
        const props = prop.$$REACT_STORE_CONTEXT_PROPS$$;
        const stateProps = props.mapStateToProps(props.value.getState());
        const dispatchProps = props.mapDispatchToProps ? props.mapDispatchToProps(props.value.dispatch) : {};
        this.state = {
            ...props.parProps,
            ...dispatchProps,
            ...stateProps,
        }
    }
 
    shouldComponentUpdate(np, ns) {
        console.log(this.state === ns);
        return true
    }
    componentDidMount() {
        const props = this.props.$$REACT_STORE_CONTEXT_PROPS$$;
        props.value.subscribe(() => {
            this.setState({
                ...props.mapStateToProps(props.value.getState()),
            })
        })
    }
    render() {
        const props = this.props.$$REACT_STORE_CONTEXT_PROPS$$;
        const {BaseComponent} = props;
        return <BaseComponent {...this.state} dispatch={props.value.dispatch} />
    }
}
