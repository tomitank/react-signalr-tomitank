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
import { HubConnection, HubConnectionBuilder, HubConnectionState, IHttpConnectionOptions, IStreamResult } from "@microsoft/signalr";

type ProviderProps = {
    url: string;
    children: React.ReactNode;
    options: IHttpConnectionOptions;
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
 * @example <SignalRProvider url={axiosInstance.defaults.baseURL+'/hub'} options={{withCredentials:true}}>
 * <></>
 * </SignalRProvider>
 */
export const SignalRProvider = ({children, url, options}: ProviderProps) => {
    const errorHandler = useErrorHandler();
    const {authState, userDetails} = useAuthContext();
    const [connection, setConnection] = useState<HubConnection|null>(null);

    const updateConnection = function(this: HubConnection) { // hack by (Tamas Kuzmics^^) to update connection states..
        setConnection(prev => Object.create(this));
    };

    useEffect(() => {
        const _connection = new HubConnectionBuilder()
        .withUrl(url, options).withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => { // infinity reconnection against disconnect..
                return Math.random() * 10000; // wait between 0 and 10 seconds before the next reconnect attempt
            }
        }).build();

        _connection.onclose(updateConnection);
        _connection.onreconnected(updateConnection);
        _connection.onreconnecting(updateConnection);

        // overwrite functions to keep _connection as "this" and add handle error..
        const origOn = _connection.on;
        const origOff = _connection.off;
        const origSend = _connection.send;
        const origInvoke = _connection.invoke;
        const origStream = _connection.stream;
        _connection.on = (methodName: string, newMethod: (...args: any[]) => void) => origOn.call(_connection, methodName, newMethod);
        _connection.off = (methodName: string, method?: (...args: any[]) => void) => origOff.call(_connection, methodName, method!);
        _connection.send = (methodName: string, ...args: any[]) => origSend.call(_connection, methodName, ...args).catch(errorHandler) as Promise<void>;
        _connection.invoke = <T extends any>(methodName: string, ...args: any[]) => origInvoke.call(_connection, methodName, ...args).catch(errorHandler) as Promise<T>;
        _connection.stream = <T extends any>(methodName: string, ...args: any[]) => origStream.call(_connection, methodName, ...args) as IStreamResult<T>;

        if (authState === AuthStates.Done && userDetails)
        {
            if (_connection.state === HubConnectionState.Disconnected) {
                setTimeout(()=> { // hack: wait disconnected state after unmount..
                    setConnection(_connection);
                    _connection.start().then(() => {
                        updateConnection.call(_connection);
                    }).catch((reason) => {
                        updateConnection.call(_connection);
                        errorHandler({message: `Socket error! ${reason}`, lifeTime: ToastLifeTime.OneDay});
                    });
                }, 0);
            }
        }

        return () => {
            _connection.stop();
        }
    }, [authState, userDetails]);

    return (
        <SignalRContext.Provider value={{connection}}>
            {children}
        </SignalRContext.Provider>
    );
};
