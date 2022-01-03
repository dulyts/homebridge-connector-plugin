import { Service, PlatformAccessory, CharacteristicValue, Characteristic } from "homebridge";

import { ExampleHomebridgePlatform } from "./platform";

import { ConnectorBridgeService } from "./bridgeCommunication";
import { filter } from "rxjs/operators";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ExamplePlatformAccessory {
    private service: Service;
    private $conn: ConnectorBridgeService;

    private state = {
        position: 0,
        state: this.platform.Characteristic.PositionState.STOPPED,
    };

    constructor(private readonly platform: ExampleHomebridgePlatform, private readonly accessory: PlatformAccessory) {
        this.$conn = ConnectorBridgeService.get();

        // set accessory information
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, "Default-Manufacturer")
            .setCharacteristic(this.platform.Characteristic.Model, "Default-Model")
            .setCharacteristic(this.platform.Characteristic.SerialNumber, "Default-Serial");

        // get the LightBulb service if it exists, otherwise create a new LightBulb service
        // you can create multiple services for each accessory
        this.service =
            this.accessory.getService(this.platform.Service.WindowCovering) ||
            this.accessory.addService(this.platform.Service.WindowCovering);

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(this.platform.Characteristic.Name, "Default name");

        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/Lightbulb

        // Current Position
        // Position State
        // Target Position

        // register handlers for the On/Off Characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentPosition)
            .onGet(this.getCurrentPosition.bind(this));

        this.service
            .getCharacteristic(this.platform.Characteristic.PositionState)
            .onGet(this.getPositionState.bind(this));

        this.service
            .getCharacteristic(this.platform.Characteristic.TargetPosition)
            .onGet(this.getTargetPosition.bind(this))
            .onSet(this.setTargetPosition.bind(this));

        setInterval(() => {
            this.$conn.sendMessage({
                msgType: "ReadDevice",
                mac: this.accessory.context.device.mac,
                deviceType: this.accessory.context.device.deviceType,
            });
        }, platform.config.refreshInterval);

        this.$conn.messageSubject
            .pipe(
                filter((response: any) => {
                    return response.mac === this.accessory.context.device.mac && response.msgType === "ReadDeviceAck";
                })
            )
            .subscribe((resp: any) => {
                this.state.position = 100 - resp.data.currentPosition;
                switch (resp.data.operation) {
                    case 0:
                        this.state.state = this.platform.Characteristic.PositionState.DECREASING;
                        break;
                    case 1:
                        this.state.state = this.platform.Characteristic.PositionState.INCREASING;
                        break;
                    case 2:
                        this.state.state = this.platform.Characteristic.PositionState.STOPPED;
                        break;
                    default:
                        break;
                }
            });
    }

    getCurrentPosition(): CharacteristicValue {
        this.platform.log.debug("Get Characteristic CurrentPosition", this.state.position);
        return this.state.position;
    }

    getPositionState(): CharacteristicValue {
        this.platform.log.debug("Get Characteristic PositionState", this.state.state);
        return this.state.state;
    }

    async getTargetPosition(): Promise<CharacteristicValue> {
        this.platform.log.debug("Get Characteristic TargetPosition", this.state.position);
        return this.state.position;
    }

    async setTargetPosition(value: CharacteristicValue) {
        this.platform.log.debug("Set Characteristic TargetPosition ->", value);
        this.$conn.sendMessage({
            msgType: "WriteDevice",
            mac: this.accessory.context.device.mac,
            deviceType: this.accessory.context.device.deviceType,
            data: {
                operation: value < this.state.position ? 0 : 1,
                targetPosition: 100 - Number(value),
            },
        });
    }
}
