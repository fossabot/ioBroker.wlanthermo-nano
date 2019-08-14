'use strict';

/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios');
let data, settings, unit_device, connection_error, intervall, initialise; // , info, networklist; ==> these options from APi are currenlty not used

// Load your modules here, e.g.:
// const fs = require('fs');

class WlanthermoNano extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'wlanthermo-nano',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('objectChange', this.onObjectChange.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.log.info('startet, state refresh every ' + this.config.Time_Sync + ' seconds');
		
		// Set  initialise variable to ensure state creation is only handled once
		initialise = true;
		
		const intervall_time = this.config.Time_Sync * 1000;
		intervall = setInterval( () => {
			this.intervall();
		}, intervall_time);

	}

	async intervall(){

		this.log.debug('Intervall run');

		// Get all current Data and system values and write to global variable for further processing
		// To-Do : implement multiple devices
		await this.get_http();

		// If connection do device failed, write error to log and ignore processing of data

		if (connection_error === false) {

			// Read some required master configuration items
			unit_device = '°' + settings.system.unit;

			// If connection do device failed, write error to log and ignore processing of data

			await this.create_device();
			await this.create_states();
			
			// Initialisation finished.
			initialise = false;

		} else {

			this.log.error('Unable to connect to device, check ip and port settings !');

		}
	}


	async get_http(){
		try {

			const url = 'http://' + this.config.receive_1 + '.' + this.config.receive_2 + '.' + this.config.receive_3 + '.' + this.config.receive_4 + ':' + this.config.receive_port;
			this.log.debug('URL : ' + url);
			const response_data = await axios(url + '/data');
			this.log.debug(response_data);
			data = response_data.data;	
			this.log.debug('Data from get_http function : ' + JSON.stringify(data));

			const response_settings = await axios(url + '/settings');
			settings = response_settings.data;
			this.log.debug('Settings from get_http function : ' + JSON.stringify(settings));			

			// API present but information not interesting to be used, disabled
			// const response_info = await axios('http://91.40.191.99:9999/info');
			// info = response_info.data;
			// this.log.debug('Info from get_http function : ' + JSON.stringify(info));

			// const_response_networklist = await axios('http://91.40.191.99:9999/networklist');
			// networklist = response_networklist.data;
			// this.log.debug('Networklist from get_http function : ' + JSON.stringify(networklist));		

			connection_error = false;

		} catch (e) {
			this.log.debug(e);
			connection_error = true;
		}
	}

	async create_device(){
		if (initialise){ 
			this.createDevice(settings.device['serial'],{
				name: settings.system['host']
			});
			this.createChannel(settings.device['serial'],'Sensors');
			this.createChannel(settings.device['serial'],'Info');
		}
	}	

	async create_states(){
		
		// Read all info related settings and write to states
		for (const i in settings.device){

			// Get type values for state
			if (initialise){ 
				
				let attr = await this.define_state_att (i);
				if (attr === undefined) {

					attr = {
						type: 'number',
						role: '',
						unit: '',
						read: true,
						write: false,
					};

				}

				this.log.debug(settings.device[i]);
				this.log.debug(i);

				await this.setObjectNotExistsAsync(settings.device['serial'] + '.Info.' + i, {
					type: 'state',
					common: {
						name: i,
						read: attr.read,
						write: attr.write,
						role: attr.role,
						unit: attr.unit ,
					},
					native: {},
				});
			}
			this.setState(settings.device['serial'] + '.Info.' + i,{ val: settings.device[i] ,ack: true });			
		}

		// Read all sensor related settings and write to states
		for (const i in data.channel) {
			// this.log.info(i);
			// this.log.info(data.channel[i].name);

			await this.setObjectNotExistsAsync(settings.device['serial'] + '.Sensors.Sensor_' + (1 + parseInt(i)), {
				type: 'channel',
				common: {
					name: data.channel[i].name,
				},
				native: {},
			});

			for (const y in data.channel[i]){

				// Get type values for state
				let attr = await this.define_state_att (y);

				if (attr === undefined) {

					attr = {
						type: 'number',
						role: '',
						unit: '',
						read: true,
						write: false,
					};
				}

				if (y === 'typ'){

					if (initialise){ 
						await this.setObjectNotExistsAsync(settings.device['serial'] + '.Sensors.Sensor_' + (1 + parseInt(i)) + '.' + y, {
							type: 'state',
							common: {
								name: y,
								read: attr.read,
								write: attr.write,
								role: attr.role,
								unit: attr.unit ,
								// 'states': {
								// 	'0': 'AUTO-MODE',
								// 	'1': 'MANU-MODE',
								// 	'2': 'PARTY-MODE',
								// 	'3': 'BOOST-MODE'
								// },
								def: 0,
							},
							native: {},
						});
					}
					this.setState(settings.device['serial'] + '.Sensors.Sensor_' + (1 + parseInt(i)) + '.' + y,{ val: data.channel[i][y] ,ack: true });

				} else {

					if (initialise){ 
						await this.setObjectNotExistsAsync(settings.device['serial'] + '.Sensors.Sensor_' + (1 + parseInt(i)) + '.' + y, {
							type: 'state',
							common: {
								name: y,
								read: attr.read,
								write: attr.write,
								role: attr.role,
								unit: attr.unit,
								def: 0,
							},
							native: {},
						});
					}
					this.setState(settings.device['serial'] + '.Sensors.Sensor_' + (1 + parseInt(i)) + '.' + y,{ val: data.channel[i][y] ,ack: true });
				}
			}	
		}

		// Read pidmaster values
		for (const i in data.pitmaster.pm){

			await this.setObjectNotExistsAsync(settings.device['serial'] + '.Pitmaster_' + (1 + parseInt(i)), {
				type: 'channel',
				common: {
					name: 'Pitmaster',
				},
				native: {},
			});
			this.log.debug(data.channel[i].name);

			for (const y in data.pitmaster.pm[i]){

				if (initialise){ 
					let attr = await this.define_state_att (y);

					if (attr === undefined) {

						attr = {
							type: 'number',
							role: '',
							unit: '',
							read: true,
							write: false,
						};

					}
					await this.setObjectNotExistsAsync(settings.device['serial'] + '.Pitmaster_' + (1 + parseInt(i)) + '.' + y, {
						type: 'state',
						common: {
							name: y,
							read: attr.read,
							write: attr.write,
							role: attr.role,
							unit: attr.unit,
							def: 0,
						},
						native: {},
					});
				}
				this.setState(settings.device['serial'] + '.Pitmaster_' + (1 + parseInt(i)) + '.' + y,{ val: data.pitmaster.pm[i][y] ,ack: true });
			}
		}
	}
	
	async define_state_att (state){

		let objekt = {};

		// Define which calculation factor must be used
		switch (state) {

			case 'alarm':
				this.log.debug('Case result : alarm');
				objekt = {
					type: 'number',
					role: 'sensor.alarm',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'api_version':
				this.log.debug('Case result : api_version');
				objekt = {
					type: 'number',
					role: 'info.api_version',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'channel':
				this.log.debug('Case result : channel');
				objekt = {
					type: 'number',
					role: 'info.channel',
					unit: '',
					read: true,
					write: false,
				};
				break;
				
			case 'color':
				this.log.debug('Case result : color');
				objekt = {
					type: 'number',
					role: 'level.color.rgb',
					unit: '',
					read: true,
					write: true,
				};
				break;

			case 'device':
				this.log.debug('Case result : device');
				objekt = {
					type: 'mixed',
					role: 'info.device',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'hw_version':
				this.log.debug('Case result : hw_version');
				objekt = {
					type: 'mixed',
					role: 'info.hw_version',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'item':
				this.log.debug('Case result : item');
				objekt = {
					type: 'mixed',
					role: 'info.item',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'id':
				this.log.debug('Case result : id');
				objekt = {
					type: 'number',
					role: 'info.id',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'language':
				this.log.debug('Case result : language');
				objekt = {
					type: 'mixed',
					role: 'info.language',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'max':
				this.log.debug('Case result : max');
				objekt = {
					type: 'number',
					role: 'value.max',
					unit: unit_device,
					read: true,
					write: true,
				};
				break;

			case 'min':
				this.log.debug('Case result : min');
				objekt = {
					type: 'number',
					role: 'value.min',
					unit: unit_device,
					read: true,
					write: true,
				};
				break;

			case 'name':
				this.log.debug('Case result : name');
				objekt = {
					type: 'mixed',
					role: 'info.name',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'number':
				this.log.debug('Case result : number');
				objekt = {
					type: 'number',
					role: 'value',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'pid':
				this.log.debug('Case result : pid');
				objekt = {
					type: 'number',
					role: 'info.pid',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'serial':
				this.log.debug('Case result : serial');
				objekt = {
					type: 'mixed',
					role: 'info.serial',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'set':
				this.log.debug('Case result : set');
				objekt = {
					type: 'number',
					role: 'value',
					unit: '%',
					read: true,
					write: false,
				};
				break;

			case 'set_color':
				this.log.debug('Case result : set_color');
				objekt = {
					type: 'mixed',
					role: 'level.color.rgb',
					unit: '%',
					read: true,
					write: true,
				};
				break;

			case 'sw_version':
				this.log.debug('Case result : sw_version');
				objekt = {
					type: 'mixed',
					role: 'info.sw_version',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'temp':
				this.log.debug('Case result : temp');
				objekt = {
					type: 'number',
					role: 'value.min',
					unit: unit_device,
					read: true,
					write: false,
				};
				break;

			case 'typ':
				this.log.debug('Case result : typ');
				objekt = {
					type: 'number',
					role: 'info.typ',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'value':
				this.log.debug('Case result : value');
				objekt = {
					type: 'number',
					role: 'value',
					unit: '',
					read: true,
					write: false,
				};
				break;

			case 'value_color':
				this.log.debug('Case result : value_color');
				objekt = {
					type: 'mixed',
					role: 'level.color.rgb',
					unit: '%',
					read: true,
					write: false,
				};
				break;

			default:
				this.log.error('Error in case handling of type identificaton : ' + state);
				return;
		}

		return objekt;

	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if (obj) {
			// The object was changed
			this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this.log.info(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new WlanthermoNano(options);
} else {
	// otherwise start the instance directly
	new WlanthermoNano();
}