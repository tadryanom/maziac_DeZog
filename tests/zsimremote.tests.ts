import * as assert from 'assert';
import {ZSimRemote} from '../src/remotes/zsimulator/zsimremote';
import {Settings} from '../src/settings/settings';
import {Utility} from '../src/misc/utility';
import {Z80RegistersClass} from '../src/remotes/z80registers';
import {MemoryModelColecoVision} from '../src/remotes/MemoryModel/predefinedmemorymodels';



suite('ZSimRemote', () => {
	let zsim: ZSimRemote;

	suite('48k', () => {

		setup(() => {
			Utility.setExtensionPath('.');
			const cfg: any = {
				remoteType: 'zsim',
				zsim: {
					zxKeyboard: true,
					visualMemory: true,
					ulaScreen: true,
					cpuLoadInterruptRange: 1,
					Z80N: false,
					vsyncInterrupt: false,
					memoryModel: "ZX48K"
				},
				history: {
					reverseDebugInstructionCount: 0,
					spotCount: 0,
					codeCoverageEnabled: false
				}
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			zsim = new ZSimRemote();
		});

		test('Check ROM', () => {
			// @ts-ignore: protected access
			zsim.configureMachine(Settings.launch.zsim);

			// Check first 2 bytes
			let value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0xAF, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x42, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x3C, value);
		});


		test('ula bank', () => {
			// @ts-ignore: protected access
			zsim.configureMachine(Settings.launch.zsim);

			let ulaBank = zsim.zxUlaScreen.currentUlaBank;
			assert.equal(1, ulaBank);
			// Should not switch
			zsim.ports.write(0x7FFD, 0b01000);
			ulaBank = zsim.zxUlaScreen.currentUlaBank;
			assert.equal(1, ulaBank);
		});
	});


	suite('memoryPagingControl, ZX128K', () => {

		setup(() => {
			Utility.setExtensionPath('.');
			const cfg: any = {
				zsim: {
					zxKeyboard: true,
					visualMemory: true,
					ulaScreen: true,
					cpuLoadInterruptRange: 1,
					Z80N: false,
					vsyncInterrupt: false,
					memoryModel: "ZX128K"
				},
				history: {
					reverseDebugInstructionCount: 0,
					spotCount: 0,
					codeCoverageEnabled: false
				}
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			Utility.setRootPath('/');	// Does not matter but must be set.
			zsim = new ZSimRemote();
			// @ts-ignore: protected access
			zsim.configureMachine(Settings.launch.zsim);
		});

		test('Check ROM 0 / 1', () => {
			// The editor ROM (0) is enabled by default

			// Check first 2 bytes
			let value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0x01, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x00, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x01, value);

			// Switch to 48K ROM
			zsim.ports.write(0x7FFD, 0b010000);

			// Check first 2 bytes
			value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0xAF, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x42, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x3C, value);

			// Switch to 128k ROM
			zsim.ports.write(0x7FFD, 0);

			// Check first 2 bytes
			value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0x01, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x00, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x01, value);
		});



		test('bank switching', () => {
			// Address used for writing/reading
			const address = 0xC000;

			// Put unique number in each bank
			for (let bank = 0; bank < 8; bank++) {
				// Do memory switch to bank x
				zsim.ports.write(0x7FFD, bank);
				// Write unique number
				zsim.memory.write8(address, 10 + bank);
			}

			// Now read the addresses and check
			for (let bank = 0; bank < 8; bank++) {
				// Do memory switch to bank x
				zsim.ports.write(0x7FFD, bank);
				// Read unique number
				const value = zsim.memory.read8(address);
				assert.equal(10 + bank, value);
			}

			// Check additionally the screen
			const value = zsim.memory.read8(address + 0x4000 - 0xC000);
			assert.equal(10 + 5, value);
		});


		test('ula switching', () => {
			let ulaBank = zsim.zxUlaScreen.currentUlaBank;
			assert.equal(5, ulaBank);

			// Shadow ULA, Bank 7
			zsim.ports.write(0x7FFD, 0b01000);
			ulaBank = zsim.zxUlaScreen.currentUlaBank;
			assert.equal(7, ulaBank);

			// Normal ULA, Bank 5
			zsim.ports.write(0x7FFD, 0);
			ulaBank = zsim.zxUlaScreen.currentUlaBank;
			assert.equal(5, ulaBank);
		});


		test('paging disable', () => {
			// Disable memory paging
			zsim.ports.write(0x7FFD, 0b0100000);

			// Try a switch to 48k ROM
			zsim.ports.write(0x7FFD, 0b010000);

			// Check that this did not happen
			let value = zsim.memory.read8(0x0001);
			assert.equal(0x01, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x01, value);
		});

	});


	suite('tbblueMemoryManagementSlots', () => {

		setup(() => {
			Utility.setExtensionPath('.');
			const cfg: any = {
				remoteType: 'zsim',
				zsim: {
					zxKeyboard: true,
					visualMemory: true,
					ulaScreen: true,
					cpuLoadInterruptRange: 1,
					Z80N: false,
					vsyncInterrupt: false,
					memoryModel: "ZXNEXT"
				},
				history: {
					reverseDebugInstructionCount: 0,
					spotCount: 0,
					codeCoverageEnabled: false
				}
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			Utility.setRootPath('/');	// Does not matter but must be set.
			zsim = new ZSimRemote();
			// @ts-ignore
			zsim.configureMachine(Settings.launch.zsim);
		});

		test('bank switching RAM', () => {
			// Put unique number in each bank
			let bank = 0;
			for (let slot = 0; slot < 8; slot++) {
				const address = slot * 0x2000;
				for (let i = 0; i < 8; i++) {
					bank++;
					// Do memory switch to bank x
					zsim.ports.write(0x243B, 0x50 + slot);
					zsim.ports.write(0x253B, bank);
					// Write unique number
					zsim.memory.write8(address, 100 + 10 * slot + bank);
				}
			}

			// Now read the addresses and check
			bank = 0;
			for (let slot = 0; slot < 8; slot++) {
				const address = slot * 0x2000;
				for (let i = 0; i < 8; i++) {
					bank++;
					// Do memory switch to bank x
					zsim.ports.write(0x243B, 0x50 + slot);
					zsim.ports.write(0x253B, bank);
					// Read unique number
					const value = zsim.memory.read8(address);
					assert.equal(100 + 10 * slot + bank, value);
				}
			}
		});

		test('bank switching ROM', () => {
			// Do memory switch to slot0/bank10
			zsim.ports.write(0x243B, 0x50 + 0);
			zsim.ports.write(0x253B, 10);
			// Do memory switch to slot1/bank11
			zsim.ports.write(0x243B, 0x50 + 1);
			zsim.ports.write(0x253B, 11);
			// Write unique numbers
			zsim.memory.write8(0x0000, 100);
			zsim.memory.write8(0x0001, 101);
			zsim.memory.write8(0x3FFE, 102);
			zsim.memory.write8(0x3FFF, 103);

			// Switch to ROM
			zsim.ports.write(0x243B, 0x50 + 0);
			zsim.ports.write(0x253B, 0xFF);
			zsim.ports.write(0x243B, 0x50 + 1);
			zsim.ports.write(0x253B, 0xFF);

			// Check first 2 bytes
			let value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0xAF, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x42, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x3C, value);

			// Switch back to RAM
			// Do memory switch to slot0/bank10
			zsim.ports.write(0x243B, 0x50 + 0);
			zsim.ports.write(0x253B, 10);
			// Do memory switch to slot1/bank11
			zsim.ports.write(0x243B, 0x50 + 1);
			zsim.ports.write(0x253B, 11);
			// Check bytes
			value = zsim.memory.read8(0x0000);
			assert.equal(100, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(101, value);
			value = zsim.memory.read8(0x3FFE);
			assert.equal(102, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(103, value);
		});

	});

	suite('COLECOVISION', () => {

		setup(() => {
			Utility.setExtensionPath('.');
			const cfg: any = {
				remoteType: 'zsim',
				zsim: {
					vsyncInterrupt: false,
					memoryModel: "COLECOVISION"
				},
				history: {
					reverseDebugInstructionCount: 0,
					spotCount: 0,
					codeCoverageEnabled: false
				}
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			zsim = new ZSimRemote();
		});

		test('Check Memory Model', () => {
			// @ts-ignore: protected access
			zsim.configureMachine(Settings.launch.zsim);

			assert.ok(zsim.memoryModel instanceof MemoryModelColecoVision);
		});
	});
});

