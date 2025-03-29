/**
 * Simple react signalR provider with state tracking
 * !connection updated when state is changed!
 * Author: Tamas Kuzmics (Hungary)
 * Email: tanky.hu@gmail.com
 * https://github.com/tomitank
 */

import { AuthStates, useAuthContext } from "./auth";
import { createContext, useContext, useEffect, useState } from "react";
import { ToastLifeTime, useErrorHandler } from "src/hooks/errorHandler";
import { HubConnection, HubConnectionBuilder, HubConnectionState, IHttpConnectionOptions } from "@microsoft/signalr";

type ProviderProps = {
    url: string;
    children: React.ReactNode;
    options: IHttpConnectionOptions;
    eventProvider: ({children, connection}: {children: React.ReactNode, connection: HubConnection|null}) => JSX.Element;
};

export type SignalRContextProps = {
    connection: HubConnection|null;
};

export const SignalRContext = createContext<SignalRContextProps>({
    connection: null
});

export const useSignalRContext = () => {
    return useContext(SignalRContext);
};

/**
 * Create state tracked signalR connection for react app
 * @author Tamas Kuzmics
 * @email tanky.hu@gmail.com
 * @link https://github.com/tomitank
 * @param url string
 * @param options IHttpConnectionOptions
 * @info reconnect is infinity
 * @requires AuthProvider
 * @returns Provider
 * @example <SignalRProvider url={axiosInstance.defaults.baseURL+'/hub'} options={{withCredentials:true}} eventProvider={SocketEventProvider}>
 * <></>
 * </SignalRProvider>
 */
export const SignalRProvider = ({children, url, options, eventProvider}: ProviderProps) => {
    const errorHandler = useErrorHandler();
    const {authState, userDetails} = useAuthContext();
    const [connection, setConnection] = useState<HubConnection|null>(null);

    const updateConnection = function(this: HubConnection) { // hack by (Tamas Kuzmics^^) to update connection states..
        setConnection(prev => {
            const newConnection = Object.create(this);
            // this solved inside eventHandler -> we call .off(method) before .on(method)
            /*if (this.state === HubConnectionState.Connected) {
                newConnection._methods = []; // hack: clear after (re)connection, bacuse of methods fn refrerences droped..
            }*/
            return newConnection;
        });
    };

    useEffect(() => {
        const _connection = new HubConnectionBuilder()
        .withUrl(url, options).withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => { // infinity reconnection against disconnect
                return Math.random() * 10000; // wait between 0 and 10 seconds before the next reconnect attempt.
            }
        }).build();

        _connection.onclose(updateConnection);
        _connection.onreconnected(updateConnection);
        _connection.onreconnecting(updateConnection);

        // overwrite send and invoke to catch error
        const origSend = _connection.send;
        const origInvoke = _connection.invoke;
        _connection.send = function(this: any, methodName: string, ...args: any[]) {
            return origSend.call(this, methodName, ...args).catch(errorHandler) as Promise<void>;
        };
        _connection.invoke = function<T = any>(this: any, methodName: string, ...args: any[]) {
            return origInvoke.call(this, methodName, ...args).catch(errorHandler) as Promise<T>;
        };

        //@ts-ignore Hack: copy old methods after unmount..
        connection !== null && (_connection._methods = connection._methods);
        setConnection(_connection); // save

        if (authState === AuthStates.Done && userDetails)
        {
            if (_connection.state === HubConnectionState.Disconnected) {
                _connection.start().then(() => {
                    updateConnection.call(_connection);
                }).catch((reason) => {
                    updateConnection.call(_connection);
                    errorHandler({message: `Socket error! ${reason}`, lifeTime: ToastLifeTime.OneDay});
                });
            }
        }

        return () => {
            _connection.stop();
        }
    }, [authState, userDetails]);

    return (
        <SignalRContext.Provider value={{connection}}>
            {eventProvider({children, connection})}
        </SignalRContext.Provider>
    );
};
