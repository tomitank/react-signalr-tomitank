# react-signalr-tomitank
Simple, stable react signalR provider with status tracking

```
<SignalRProvider
 url={axiosInstance.defaults.baseURL+'/hub'}
 options={{withCredentials:true}}
 dependecies={[isAuthenticated]}
 startCondition={isAuthenticated}
 onError={(error) => console.error(error)}
>
  <SocketEventProvider>
    <>{children}</>
  </SocketEventProvider>
 </SignalRProvider>
```

```
import { HubConnectionState } from "@microsoft/signalr";
import { useSignalRContext } from "react-signalr-tomitank";
import { createContext, useContext, useEffect, useState } from "react";

export type SocketEventContextProps = {
};

export const SocketEventContext = createContext<SocketEventContextProps>({});

export const useSocketEventContext = () => {
    return useContext(SocketEventContext);
};

export function SocketEventProvider({children}: {children: React.ReactNode}) {
    const { connection } = useSignalRContext();

    useEffect(() => {
        console.log('event:'+connection?.state, 'id:'+connection?.connectionId);
        if (connection?.state === HubConnectionState.Connecting) { // add event handlers while connecting..
            // example
            connection?.on('test', (response: any) => console.log(response));
        } else if (connection?.state === HubConnectionState.Connected) { // joint to room right after connected..
            console.log('Socket connected!');
            // example
            connection?.invoke('JoinRoom', 'test-room');
        }
        // reconnecting message
        if (connection?.state === HubConnectionState.Reconnecting) {
            console.log('Reconnecting..');
        }
    }, [connection]);

    return (
        <SocketEventContext.Provider value={{ socketStates, setSocketStates }}>
            {children}
        </SocketEventContext.Provider>
    );
}
```
