import {Utility} from "../../misc/utility";
import {MemoryModel} from "./memorymodel";


/**
 * Contains the predefined memory models for ZX16k, ZX48K, ZX128 and ZXNext
 */


/**
 * Default model for MAME.
 * Nothing known.
 */
export class MemoryModelUnknown extends MemoryModel {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0xFFFF],
					banks: [
						{
							index: 0,
							name: 'UNKNOWN'
						}
					]
				}
			]
		});
		this.name = 'UNKNOWN';
	}
}


/**
 * Model with all RAM.
 */
export class MemoryModelAllRam extends MemoryModel {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0xFFFF],
					banks: [
						{
							index: 0,
							name: 'RAM'
						}
					]
				}
			]
		});
		this.name = 'RAM';
	}
}


/**
 * ZX Spectrum base definition.
 */
export class MemoryModelZxSpectrumBase extends MemoryModel {
}


/**
 * ZX16K
 * ROM + RAM, above 0x8000 unassigned.
 */
export class MemoryModelZx16k extends MemoryModelZxSpectrumBase {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0x3FFF],
					banks: [
						{
							index: 0,
							name: 'ROM',
							rom: Utility.getExtensionPath() + '/data/48.rom'
						}
					]
				},
				{
					range: [0x4000, 0x7FFF],
					banks: [
						{
							index: 1,
							name: 'RAM'
						}
					]
				},
			]
		});
		this.name = 'ZX16K';
	}
}


/**
 * ZX48K
 * 16K ROM + 48K RAM
 */
export class MemoryModelZx48k extends MemoryModelZxSpectrumBase {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0x3FFF],
					banks: [
						{
							index: 0,
							name: 'ROM',
							rom: Utility.getExtensionPath() + '/data/48.rom'
						}
					]
				},
				{
					range: [0x4000, 0xFFFF],
					banks: [
						{
							index: 1,
							name: 'RAM'
						}
					]
				},
			]
		});
		this.name = 'ZX48K';
	}
}


/**
 * ZX128K
 * 8 RAM banks a 16k.
 * 2 ROMs
 */
export class MemoryModelZx128k extends MemoryModelZxSpectrumBase {
	constructor(ramBanks = 8) {
		super({
			slots: [
				{
					range: [0x0000, 0x3FFF],
					name: "slotROM",
					initialBank: 8,
					banks: [
						{
							index: 8,
							name: 'ROM0',
							shortName: 'R0',
							rom: Utility.getExtensionPath() + '/data/128.rom' 	// 128k editor
						},
						{
							index: 9,
							name: 'ROM1',
							shortName: 'R1',
							rom: Utility.getExtensionPath() + '/data/48.rom'
						}
					]
				},
				{
					range: [0x4000, 0x7FFF],
					banks: [
						{
							index: 5
						}
					]
				},
				{
					range: [0x8000, 0xBFFF],
					banks: [
						{
							index: 2
						}
					]
				},
				{
					range: [0xC000, 0xFFFF],
					name: "slotC000",
					initialBank: 0,
					banks: [
						{
							index: [0, ramBanks-1],
						}
					]
				}
			],
			ioMmu: [
				"var disabled;",
				"if((portAddress | 0x7FFD) == 0x7FFD && !disabled) {",
				"  slotC000 = portValue & 0x07; // RAM block select",
				"  disabled = portValue & 0b0100000; // DIS",
				"  slotROM = ((portValue & 0b0010000) >>> 4) + 8;",
				"}"
			]
		});
		this.name = 'ZX128K';
	}
}


/**
 * ZX256K
 * 16 RAM banks a 16k.
 * 2 ROMs
 */
/*
Too many clones: https://zx-pk.ru/threads/11490-paging-ports-of-zx-clones.html?langid=1
I think I leave it with the ZX128K.
export class MemoryModelZx256k extends MemoryModelZx128k {
	constructor() {
		super(16);	// 16 RAM banks
		this.name = 'ZX256K';
		this.ioMmu = [
			"var disabled;",
			"if((portAddress | 0x7FFD) == 0x7FFD && !disabled) {",
			"  slotC000 = portValue & 0x07; // RAM block select",
			"  disabled = portValue & 0b0100000; // DIS",
			"  slotROM = ((portValue & 0b0010000) >>> 4) + 8;",
			"}"
		].join('\n');
	}
}
*/


/** Virtual class  used as base for MemoryModelZxNextOneRom and MemoryModelZxNextTwoRom.
 * Is itself not instantiated.
 */
export class MemoryModelZxNextBase extends MemoryModelZxSpectrumBase {
	/**
	 * Remove the check for same bank shortNames.
	 */
	protected checkShortName(_index: number) {
		//
	}


	/** Additionally uses the address to correctly parse the ROM bank number.
	 * @param addr64k A 64k address.
	 * @param bankString The string representing the short bank name. Used by the rev-eng parser. Can be undefined. Then the bank is derived from the slot.
	 * @returns The bank number.
	 */
	public parseBank(addr64k: number, bankString: string): number {
		if (bankString) {
			// Parse bank
			let bank = this.parseShortNameForBank(bankString);
			// Adjust bank number (for ROM1 and ROM0)
			if ((bank === 0xFF || bank === 0xFD) && addr64k < 0x2000) {
				// Decrement bank number: 0xFE or 0xFC
				bank--;
			}
			const banks = this.getBanksFor(addr64k);
			if (!banks.has(bank))
				throw Error("Bank '" + bankString + "' is not reachable from address " + Utility.getHexString(addr64k, 4) + ".");
			return bank;
		}

		// Otherwise: normal parsing
		return super.parseBank(addr64k, bankString);
	}
}


/**
 * The ZX Next memory model used by zsim and zesarux:
 * It supports ROM1 (ZX Basic) and ROM0 (128k editor).
 * 8 slots per 8k.
 * 0000-1FFF: RAM/ROM0/ROM1
 * 2000-3FFF: RAM/ROM0/ROM1
 * 4000-5FFF: RAM
 * 6000-7FFF: RAM
 * 8000-9FFF: RAM
 * A000-BFFF: RAM
 * C000-DFFF: RAM
 * E000-FFFF: RAM
 * The unexpanded ZXNext has 0-95 8k banks.
 * The expanded has: 0-223 8k banks.
 * Banks 0xFC to 0xFF are ROM.
 * Note: 0xFC, FD, FE are invented, in a ZxNext there is only 0xFF.
 * ROM0, lower 2k: 0xFC
 * ROM0, upper 2k: 0xFD
 * ROM1, lower 2k: 0xFE
 * ROM1, upper 2k: 0xFF
 */
export class MemoryModelZxNextTwoRom extends MemoryModelZxNextBase {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0x1FFF],
					initialBank: 0xFE,
					banks: [
						{
							index: [0, 223],	// 254  RAM banks
						},
						{
							index: 0xFC,
							name: 'ROM0',
							shortName: 'R0',
							rom: Utility.getExtensionPath() + '/data/128.rom' 	// 1
						},
						{
							index: 0xFE,
							name: 'ROM1',
							shortName: 'R1',
							rom: Utility.getExtensionPath() + '/data/48.rom'
						},
					]
				},
				{
					range: [0x2000, 0x3FFF],
					initialBank: 0xFF,
					banks: [
						{
							index: [0, 223],	// All banks are already defined in previous range
						},
						{
							index: 0xFD,
							name: 'ROM0',
							shortName: 'R0',	// Same name, overwrites mapping
							rom: Utility.getExtensionPath() + '/data/128.rom',
							romOffset: 0x2000
						},
						{
							index: 0xFF,
							name: 'ROM1',
							shortName: 'R1',	// Same name, overwrites mapping
							rom: Utility.getExtensionPath() + '/data/48.rom',
							romOffset: 0x2000
						},
					]
				},
				{
					range: [0x4000, 0x5FFF],
					initialBank: 10,
					banks: [{index: [0, 255]}]
				},
				{
					range: [0x6000, 0x7FFF],
					initialBank: 11,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0x8000, 0x9FFF],
					initialBank: 4,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0xA000, 0xBFFF],
					initialBank: 5,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0xC000, 0xDFFF],
					initialBank: 0,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0xE000, 0xFFFF],
					initialBank: 1,
					banks: [{index: [0, 223]}]
				}
			],
			// ioMmu is undefined because memory management is implemented programmatically.
			// The writing of the the slot register would be possible to implement here,
			// but the port also needs to support reading of the register,
			// what cannot be supported here.
			ioMmu: [
				"var disabled;",
				"if((portAddress | 0x7FFD) == 0x7FFD && !disabled) {",
				"  bank = 2*(portValue & 0x07); // RAM block select",
				"  slots[6] = bank;",
				"  slots[7] = bank+1;",
				"  romBank = 0xFC + 2*((portValue & 0b0010000) >>> 4);",
				"  slots[0] = romBank;",
				"  slots[1] = romBank+1;",
				"  disabled = portValue & 0b0100000; // DIS",
				"}"
			]
		});
		this.name = 'ZXNEXT';
	}
}


/**
 * The ZX Next memory model used by CSpect and ZXNext:
 * For both I cannot determine which ROM is in use, so I indicate only "ROM" not
 * "ROM1" or "ROM0".
 * 8 slots per 8k.
 * 0000-1FFF: RAM/ROM
 * 2000-3FFF: RAM/ROM
 * 4000-5FFF: RAM
 * 6000-7FFF: RAM
 * 8000-9FFF: RAM
 * A000-BFFF: RAM
 * C000-DFFF: RAM
 * E000-FFFF: RAM
 * The unexpanded ZXNext has 0-95 8k banks.
 * The expanded has: 0-223 8k banks.
 * Banks 0xFC to 0xFF are ROM.
 * Note: 0xFC, FD, FE are invented, in a ZxNext there is only 0xFF.
 * ROM0, lower 2k: 0xFC
 * ROM0, upper 2k: 0xFD
 * ROM1, lower 2k: 0xFE
 * ROM1, upper 2k: 0xFF
 */
export class MemoryModelZxNextOneROM extends MemoryModelZxNextBase {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0x1FFF],
					initialBank: 0xFE,
					banks: [
						{
							index: [0, 223],	// 254  RAM banks
						},
						{
							index: 0xFE,
							name: 'ROM',
							shortName: 'R',
							rom: true
						},
					]
				},
				{
					range: [0x2000, 0x3FFF],
					initialBank: 0xFF,
					banks: [
						{
							index: [0, 223],	// All banks are already defined in previous range
						},
						{
							index: 0xFF,
							name: 'ROM',
							shortName: 'R',
							rom: true
						},
					]
				},
				{
					range: [0x4000, 0x5FFF],
					initialBank: 10,
					banks: [{index: [0, 255]}]
				},
				{
					range: [0x6000, 0x7FFF],
					initialBank: 11,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0x8000, 0x9FFF],
					initialBank: 4,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0xA000, 0xBFFF],
					initialBank: 5,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0xC000, 0xDFFF],
					initialBank: 0,
					banks: [{index: [0, 223]}]
				},
				{
					range: [0xE000, 0xFFFF],
					initialBank: 1,
					banks: [{index: [0, 223]}]
				}
			],
		});
		this.name = 'ZXNEXT';
	}
}


/** The ColecoVision memory model:
 * 0000-1FFF = ColecoVision BIOS OS 7' (BIOS)
 * 2000-5FFF = Expansion port (EXP)
 * 6000-7FFF = 1K RAM mapped into 8K (7000-73FF) (RAM)
 * 8000-FFFF = Game Cartridge (CR)
 *
 * ZEsarUX uses:
 * 0000-1FFF = BIOS ROM (BIO)
 * 2000-3FFF = Expansion port (EXP)
 * 4000-5FFF = Expansion port (EXP)
 * 6000-7FFF = RAM (1K mapped into an 8K spot) (RAM)
 * 8000-9FFF = Cart ROM (CR)
 * A000-BFFF = Cart ROM (CR)
 * C000-DFFF = Cart ROM (CR)
 * E000-FFFF = Cart ROM (CR)
 */
export class MemoryModelColecoVision extends MemoryModel {
	constructor() {
		super({
			slots: [
				{
					range: [0x0000, 0x1FFF],
					banks: [
						{
							index: 0,
							name: 'BIOS',
							shortName: 'BIOS',
							rom: true
						}
					]
				},
				{
					range: [0x2000, 0x5FFF],
					banks: [
						{
							index: 1,
							name: 'Expansion port',
							shortName: 'EXP',
						}
					]
				},
				{
					range: [0x7000, 0x73FF],
					banks: [
						{
							index: 2,
							name: 'RAM (1k)',
							shortName: 'RAM'
						}
					]
				},
				{
					range: [0x8000, 0xFFFF],
					banks: [
						{
							index: 3,
							name: 'Cartridge ROM',
							shortName: 'CR',
							rom: true
						}
					]
				}
			]
		});
		this.name = 'ColecoVision';
	}
}
