import { useState, useEffect, useMemo, useCallback } from “react”;

// ============================================================
// RULESET DATA (from ruleset.yaml)
// Slot notation: ‘A1’ = group A, draw position 1
// After group stage, resolved to ‘p:A:1’ = rank 1 in group A
// ============================================================
const RULESETS = {
12: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A2’},{id:‘G2’,home:‘A3’,away:‘A4’},
{id:‘G3’,home:‘B1’,away:‘B2’},{id:‘G4’,home:‘B3’,away:‘B4’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘A1’,away:‘A3’},{id:‘G8’,home:‘A2’,away:‘A4’},
{id:‘G9’,home:‘B1’,away:‘B2’},{id:‘G10’,home:‘B3’,away:‘B4’},
{id:‘G11’,home:‘C1’,away:‘C3’},{id:‘G12’,home:‘C2’,away:‘C4’},
{id:‘G13’,home:‘A1’,away:‘A4’},{id:‘G14’,home:‘A2’,away:‘A3’},
{id:‘G15’,home:‘B1’,away:‘B3’},{id:‘G16’,home:‘B2’,away:‘B4’},
{id:‘G17’,home:‘C1’,away:‘C4’},{id:‘G18’,home:‘C2’,away:‘C3’},
],
playoffs: {
rounds: [
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘b3:1’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘b3:2’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘r:B:2’,winRef:‘W3’},
{id:‘QF4’,home:‘r:A:2’,away:‘r:C:2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
best3: { groups:[‘A’,‘B’,‘C’], count:2 },
}
},
13: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B2’},{id:‘G4’,home:‘B3’,away:‘B4’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘A1’,away:‘A2’},{id:‘G8’,home:‘A3’,away:‘A4’},
{id:‘G9’,home:‘B1’,away:‘B2’},{id:‘G10’,home:‘B3’,away:‘B4’},
{id:‘G11’,home:‘C1’,away:‘C3’},{id:‘G12’,home:‘C2’,away:‘C4’},
{id:‘G13’,home:‘A1’,away:‘A5’},{id:‘G14’,home:‘A2’,away:‘A4’},
{id:‘G15’,home:‘B1’,away:‘B3’},{id:‘G16’,home:‘B2’,away:‘B4’},
{id:‘G17’,home:‘A3’,away:‘A5’},{id:‘G18’,home:‘A1’,away:‘A4’},
{id:‘G19’,home:‘B1’,away:‘B4’},{id:‘G20’,home:‘A2’,away:‘A3’},
{id:‘G21’,home:‘A4’,away:‘A5’},{id:‘G22’,home:‘B2’,away:‘B3’},
{id:‘G23’,home:‘C1’,away:‘C4’},{id:‘G24’,home:‘C2’,away:‘C3’},
],
playoffs: {
rounds: [
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘b3:BC’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘r:A:3’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘r:B:2’,winRef:‘W3’},
{id:‘QF4’,home:‘r:A:2’,away:‘r:C:2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
best3: { groups:[‘B’,‘C’], count:1 },
}
},
14: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’,‘B5’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B3’},{id:‘G4’,home:‘B2’,away:‘B5’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘A1’,away:‘A2’},{id:‘G8’,home:‘A3’,away:‘A4’},
{id:‘G9’,home:‘B1’,away:‘B2’},{id:‘G10’,home:‘B3’,away:‘B4’},
{id:‘G11’,home:‘C1’,away:‘C3’},{id:‘G12’,home:‘C2’,away:‘C4’},
{id:‘G13’,home:‘A1’,away:‘A5’},{id:‘G14’,home:‘A2’,away:‘A4’},
{id:‘G15’,home:‘B1’,away:‘B5’},{id:‘G16’,home:‘B2’,away:‘B4’},
{id:‘G17’,home:‘A3’,away:‘A5’},{id:‘G18’,home:‘A1’,away:‘A4’},
{id:‘G19’,home:‘B3’,away:‘B5’},{id:‘G20’,home:‘B1’,away:‘B4’},
{id:‘G21’,home:‘A2’,away:‘A3’},{id:‘G22’,home:‘A4’,away:‘A5’},
{id:‘G23’,home:‘B2’,away:‘B3’},{id:‘G24’,home:‘B4’,away:‘B5’},
{id:‘G25’,home:‘C1’,away:‘C4’},{id:‘G26’,home:‘C2’,away:‘C3’},
],
playoffs: {
rounds: [
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘r:B:3’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘r:A:3’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘r:B:2’,winRef:‘W3’},
{id:‘QF4’,home:‘r:A:2’,away:‘r:C:2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
15: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’,‘B5’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’,‘C5’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B3’},{id:‘G4’,home:‘B2’,away:‘B5’},
{id:‘G5’,home:‘C1’,away:‘C3’},{id:‘G6’,home:‘C2’,away:‘C5’},
{id:‘G7’,home:‘A1’,away:‘A2’},{id:‘G8’,home:‘A3’,away:‘A4’},
{id:‘G9’,home:‘B1’,away:‘B2’},{id:‘G10’,home:‘B3’,away:‘B4’},
{id:‘G11’,home:‘C1’,away:‘C2’},{id:‘G12’,home:‘C3’,away:‘C4’},
{id:‘G13’,home:‘A1’,away:‘A5’},{id:‘G14’,home:‘A2’,away:‘A4’},
{id:‘G15’,home:‘B1’,away:‘B5’},{id:‘G16’,home:‘B2’,away:‘B4’},
{id:‘G17’,home:‘C1’,away:‘C5’},{id:‘G18’,home:‘C2’,away:‘C4’},
{id:‘G19’,home:‘A3’,away:‘A5’},{id:‘G20’,home:‘A1’,away:‘A4’},
{id:‘G21’,home:‘B3’,away:‘B5’},{id:‘G22’,home:‘B1’,away:‘B4’},
{id:‘G23’,home:‘C3’,away:‘C5’},{id:‘G24’,home:‘C1’,away:‘C4’},
{id:‘G25’,home:‘A2’,away:‘A3’},{id:‘G26’,home:‘A4’,away:‘A5’},
{id:‘G27’,home:‘B2’,away:‘B3’},{id:‘G28’,home:‘B4’,away:‘B5’},
{id:‘G29’,home:‘C2’,away:‘C3’},{id:‘G30’,home:‘C4’,away:‘C5’},
],
playoffs: {
rounds: [
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘b3:1’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘b3:2’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘r:B:2’,winRef:‘W3’},
{id:‘QF4’,home:‘r:A:2’,away:‘r:C:2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
best3: { groups:[‘A’,‘B’,‘C’], count:2 },
}
},
16: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A2’},{id:‘G2’,home:‘A3’,away:‘A4’},
{id:‘G3’,home:‘B1’,away:‘B2’},{id:‘G4’,home:‘B3’,away:‘B4’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘D1’,away:‘D2’},{id:‘G8’,home:‘D3’,away:‘D4’},
{id:‘G9’,home:‘A1’,away:‘A3’},{id:‘G10’,home:‘A2’,away:‘A4’},
{id:‘G11’,home:‘B1’,away:‘B3’},{id:‘G12’,home:‘B2’,away:‘B4’},
{id:‘G13’,home:‘C1’,away:‘C3’},{id:‘G14’,home:‘C2’,away:‘C4’},
{id:‘G15’,home:‘D1’,away:‘D3’},{id:‘G16’,home:‘D2’,away:‘D4’},
{id:‘G17’,home:‘A1’,away:‘A4’},{id:‘G18’,home:‘A2’,away:‘A3’},
{id:‘G19’,home:‘B1’,away:‘B4’},{id:‘G20’,home:‘B2’,away:‘B3’},
{id:‘G21’,home:‘C1’,away:‘C4’},{id:‘G22’,home:‘C2’,away:‘C3’},
{id:‘G23’,home:‘D1’,away:‘D4’},{id:‘G24’,home:‘D2’,away:‘D3’},
],
playoffs: {
rounds: [
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘r:B:2’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘r:A:2’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘r:D:2’,winRef:‘W3’},
{id:‘QF4’,home:‘r:D:1’,away:‘r:C:2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
17: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B2’},{id:‘G4’,home:‘B3’,away:‘B4’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘D1’,away:‘D2’},{id:‘G8’,home:‘D3’,away:‘D4’},
{id:‘G9’,home:‘A1’,away:‘A2’},{id:‘G10’,home:‘A3’,away:‘A4’},
{id:‘G11’,home:‘B1’,away:‘B3’},{id:‘G12’,home:‘B2’,away:‘B4’},
{id:‘G13’,home:‘C1’,away:‘C3’},{id:‘G14’,home:‘C2’,away:‘C4’},
{id:‘G15’,home:‘A1’,away:‘A5’},{id:‘G16’,home:‘A2’,away:‘A4’},
{id:‘G17’,home:‘D1’,away:‘D3’},{id:‘G18’,home:‘D2’,away:‘D4’},
{id:‘G19’,home:‘B1’,away:‘B4’},{id:‘G20’,home:‘B2’,away:‘B3’},
{id:‘G21’,home:‘A3’,away:‘A5’},{id:‘G22’,home:‘A1’,away:‘A4’},
{id:‘G23’,home:‘C1’,away:‘C4’},{id:‘G24’,home:‘C2’,away:‘C3’},
{id:‘G25’,home:‘D1’,away:‘D4’},{id:‘G26’,home:‘D2’,away:‘D3’},
{id:‘G27’,home:‘A2’,away:‘A3’},{id:‘G28’,home:‘A4’,away:‘A5’},
],
playoffs: {
rounds: [
{ name:‘Omgång 1’, matches:[
{id:‘PR1’,home:‘r:A:2’,away:‘r:B:3’,winRef:‘V1’},
{id:‘PR2’,home:‘r:B:2’,away:‘r:A:3’,winRef:‘V2’},
{id:‘PR3’,home:‘r:C:2’,away:‘r:D:3’,winRef:‘V3’},
{id:‘PR4’,home:‘r:D:2’,away:‘r:C:3’,winRef:‘V4’},
]},
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘V3’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘V4’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘V1’,winRef:‘W3’},
{id:‘QF4’,home:‘r:D:1’,away:‘V2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
18: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’,‘B5’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B3’},{id:‘G4’,home:‘B2’,away:‘B5’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘D1’,away:‘D2’},{id:‘G8’,home:‘D3’,away:‘D4’},
{id:‘G9’,home:‘A1’,away:‘A2’},{id:‘G10’,home:‘A3’,away:‘A4’},
{id:‘G11’,home:‘B1’,away:‘B2’},{id:‘G12’,home:‘B3’,away:‘B4’},
{id:‘G13’,home:‘C1’,away:‘C3’},{id:‘G14’,home:‘C2’,away:‘C4’},
{id:‘G15’,home:‘A1’,away:‘A5’},{id:‘G16’,home:‘A2’,away:‘A4’},
{id:‘G17’,home:‘B1’,away:‘B5’},{id:‘G18’,home:‘B2’,away:‘B4’},
{id:‘G19’,home:‘D1’,away:‘D3’},{id:‘G20’,home:‘D2’,away:‘D4’},
{id:‘G21’,home:‘A3’,away:‘A5’},{id:‘G22’,home:‘A1’,away:‘A4’},
{id:‘G23’,home:‘B3’,away:‘B5’},{id:‘G24’,home:‘B1’,away:‘B4’},
{id:‘G25’,home:‘C1’,away:‘C4’},{id:‘G26’,home:‘C2’,away:‘C3’},
{id:‘G27’,home:‘D1’,away:‘D4’},{id:‘G28’,home:‘D2’,away:‘D3’},
{id:‘G29’,home:‘A2’,away:‘A3’},{id:‘G30’,home:‘A4’,away:‘A5’},
{id:‘G31’,home:‘B2’,away:‘B3’},{id:‘G32’,home:‘B4’,away:‘B5’},
],
playoffs: {
rounds: [
{ name:‘Omgång 1’, matches:[
{id:‘PR1’,home:‘r:A:2’,away:‘r:B:3’,winRef:‘V1’},
{id:‘PR2’,home:‘r:B:2’,away:‘r:A:3’,winRef:‘V2’},
{id:‘PR3’,home:‘r:C:2’,away:‘r:D:3’,winRef:‘V3’},
{id:‘PR4’,home:‘r:D:2’,away:‘r:C:3’,winRef:‘V4’},
]},
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘V3’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘V4’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘V1’,winRef:‘W3’},
{id:‘QF4’,home:‘r:D:1’,away:‘V2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
19: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’,‘B5’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’,‘C5’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B3’},{id:‘G4’,home:‘B2’,away:‘B5’},
{id:‘G5’,home:‘C1’,away:‘C3’},{id:‘G6’,home:‘C2’,away:‘C5’},
{id:‘G7’,home:‘D1’,away:‘D2’},{id:‘G8’,home:‘D3’,away:‘D4’},
{id:‘G9’,home:‘A1’,away:‘A2’},{id:‘G10’,home:‘A3’,away:‘A4’},
{id:‘G11’,home:‘B1’,away:‘B2’},{id:‘G12’,home:‘B3’,away:‘B4’},
{id:‘G13’,home:‘C1’,away:‘C2’},{id:‘G14’,home:‘C3’,away:‘C4’},
{id:‘G15’,home:‘D1’,away:‘D3’},{id:‘G16’,home:‘D2’,away:‘D4’},
{id:‘G17’,home:‘A1’,away:‘A5’},{id:‘G18’,home:‘A2’,away:‘A4’},
{id:‘G19’,home:‘B1’,away:‘B5’},{id:‘G20’,home:‘B2’,away:‘B4’},
{id:‘G21’,home:‘C1’,away:‘C5’},{id:‘G22’,home:‘C2’,away:‘C4’},
{id:‘G23’,home:‘A3’,away:‘A5’},{id:‘G24’,home:‘A1’,away:‘A4’},
{id:‘G25’,home:‘B3’,away:‘B5’},{id:‘G26’,home:‘B1’,away:‘B4’},
{id:‘G27’,home:‘C3’,away:‘C5’},{id:‘G28’,home:‘C1’,away:‘C4’},
{id:‘G29’,home:‘A2’,away:‘A3’},{id:‘G30’,home:‘A4’,away:‘A5’},
{id:‘G31’,home:‘B2’,away:‘B3’},{id:‘G32’,home:‘B4’,away:‘B5’},
{id:‘G33’,home:‘C2’,away:‘C3’},{id:‘G34’,home:‘C4’,away:‘C5’},
{id:‘G35’,home:‘D1’,away:‘D4’},{id:‘G36’,home:‘D2’,away:‘D3’},
],
playoffs: {
rounds: [
{ name:‘Omgång 1’, matches:[
{id:‘PR1’,home:‘r:A:2’,away:‘r:B:3’,winRef:‘V1’},
{id:‘PR2’,home:‘r:B:2’,away:‘r:A:3’,winRef:‘V2’},
{id:‘PR3’,home:‘r:C:2’,away:‘r:D:3’,winRef:‘V3’},
{id:‘PR4’,home:‘r:D:2’,away:‘r:C:3’,winRef:‘V4’},
]},
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘V3’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘V4’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘V1’,winRef:‘W3’},
{id:‘QF4’,home:‘r:D:1’,away:‘V2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
20: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’,‘A5’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’,‘B5’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’,‘C5’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’,‘D5’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A3’},{id:‘G2’,home:‘A2’,away:‘A5’},
{id:‘G3’,home:‘B1’,away:‘B3’},{id:‘G4’,home:‘B2’,away:‘B5’},
{id:‘G5’,home:‘C1’,away:‘C3’},{id:‘G6’,home:‘C2’,away:‘C5’},
{id:‘G7’,home:‘D1’,away:‘D3’},{id:‘G8’,home:‘D2’,away:‘D5’},
{id:‘G9’,home:‘A1’,away:‘A2’},{id:‘G10’,home:‘A3’,away:‘A4’},
{id:‘G11’,home:‘B1’,away:‘B2’},{id:‘G12’,home:‘B3’,away:‘B4’},
{id:‘G13’,home:‘C1’,away:‘C2’},{id:‘G14’,home:‘C3’,away:‘C4’},
{id:‘G15’,home:‘D1’,away:‘D2’},{id:‘G16’,home:‘D3’,away:‘D4’},
{id:‘G17’,home:‘A1’,away:‘A5’},{id:‘G18’,home:‘A2’,away:‘A4’},
{id:‘G19’,home:‘B1’,away:‘B5’},{id:‘G20’,home:‘B2’,away:‘B4’},
{id:‘G21’,home:‘C1’,away:‘C5’},{id:‘G22’,home:‘C2’,away:‘C4’},
{id:‘G23’,home:‘D1’,away:‘D5’},{id:‘G24’,home:‘D2’,away:‘D4’},
{id:‘G25’,home:‘A3’,away:‘A5’},{id:‘G26’,home:‘A1’,away:‘A4’},
{id:‘G27’,home:‘B3’,away:‘B5’},{id:‘G28’,home:‘B1’,away:‘B4’},
{id:‘G29’,home:‘C3’,away:‘C5’},{id:‘G30’,home:‘C1’,away:‘C4’},
{id:‘G31’,home:‘D3’,away:‘D5’},{id:‘G32’,home:‘D1’,away:‘D4’},
{id:‘G33’,home:‘A2’,away:‘A3’},{id:‘G34’,home:‘A4’,away:‘A5’},
{id:‘G35’,home:‘B2’,away:‘B3’},{id:‘G36’,home:‘B4’,away:‘B5’},
{id:‘G37’,home:‘C2’,away:‘C3’},{id:‘G38’,home:‘C4’,away:‘C5’},
{id:‘G39’,home:‘D2’,away:‘D3’},{id:‘G40’,home:‘D4’,away:‘D5’},
],
playoffs: {
rounds: [
{ name:‘Omgång 1’, matches:[
{id:‘PR1’,home:‘r:A:2’,away:‘r:B:3’,winRef:‘V1’},
{id:‘PR2’,home:‘r:B:2’,away:‘r:A:3’,winRef:‘V2’},
{id:‘PR3’,home:‘r:C:2’,away:‘r:D:3’,winRef:‘V3’},
{id:‘PR4’,home:‘r:D:2’,away:‘r:C:3’,winRef:‘V4’},
]},
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘r:A:1’,away:‘V3’,winRef:‘W1’},
{id:‘QF2’,home:‘r:B:1’,away:‘V4’,winRef:‘W2’},
{id:‘QF3’,home:‘r:C:1’,away:‘V1’,winRef:‘W3’},
{id:‘QF4’,home:‘r:D:1’,away:‘V2’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
21: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’] },
{ label: ‘E’, slots: [‘E1’,‘E2’,‘E3’,‘E4’,‘E5’] },
],
groupMatches: [
{id:‘G1’,home:‘E1’,away:‘E3’},{id:‘G2’,home:‘E2’,away:‘E5’},
{id:‘G3’,home:‘A1’,away:‘A2’},{id:‘G4’,home:‘A3’,away:‘A4’},
{id:‘G5’,home:‘B1’,away:‘B2’},{id:‘G6’,home:‘B3’,away:‘B4’},
{id:‘G7’,home:‘C1’,away:‘C2’},{id:‘G8’,home:‘C3’,away:‘C4’},
{id:‘G9’,home:‘D1’,away:‘D2’},{id:‘G10’,home:‘D3’,away:‘D4’},
{id:‘G11’,home:‘E1’,away:‘E2’},{id:‘G12’,home:‘E3’,away:‘E4’},
{id:‘G13’,home:‘A1’,away:‘A3’},{id:‘G14’,home:‘A2’,away:‘A4’},
{id:‘G15’,home:‘B1’,away:‘B3’},{id:‘G16’,home:‘B2’,away:‘B4’},
{id:‘G17’,home:‘C1’,away:‘C3’},{id:‘G18’,home:‘C2’,away:‘C4’},
{id:‘G19’,home:‘D1’,away:‘D3’},{id:‘G20’,home:‘D2’,away:‘D4’},
{id:‘G21’,home:‘E1’,away:‘E5’},{id:‘G22’,home:‘E2’,away:‘E4’},
{id:‘G23’,home:‘A1’,away:‘A4’},{id:‘G24’,home:‘A2’,away:‘A3’},
{id:‘G25’,home:‘B1’,away:‘B4’},{id:‘G26’,home:‘B2’,away:‘B3’},
{id:‘G27’,home:‘E3’,away:‘E5’},{id:‘G28’,home:‘E1’,away:‘E4’},
{id:‘G29’,home:‘C1’,away:‘C4’},{id:‘G30’,home:‘C2’,away:‘C3’},
{id:‘G31’,home:‘D1’,away:‘D4’},{id:‘G32’,home:‘D2’,away:‘D3’},
{id:‘G33’,home:‘E2’,away:‘E3’},{id:‘G34’,home:‘E4’,away:‘E5’},
],
playoffs: {
// Special: mini-group playoffs then semifinals
miniGroups: [
{ id:‘GP1’, slots:[‘r:A:1’,‘r:B:1’,‘b3:1’], winRef:‘W1’,
matches:[{id:‘GP1_M1’,home:‘r:A:1’,away:‘r:B:1’},{id:‘GP1_M2’,home:‘r:B:1’,away:‘b3:1’},{id:‘GP1_M3’,home:‘r:A:1’,away:‘b3:1’}] },
{ id:‘GP2’, slots:[‘r:C:1’,‘r:D:1’,‘b3:2’], winRef:‘W2’,
matches:[{id:‘GP2_M1’,home:‘r:C:1’,away:‘r:D:1’},{id:‘GP2_M2’,home:‘r:D:1’,away:‘b3:2’},{id:‘GP2_M3’,home:‘r:C:1’,away:‘b3:2’}] },
{ id:‘GP3’, slots:[‘r:C:2’,‘r:D:2’,‘r:E:1’], winRef:‘W3’,
matches:[{id:‘GP3_M1’,home:‘r:C:2’,away:‘r:D:2’},{id:‘GP3_M2’,home:‘r:D:2’,away:‘r:E:1’},{id:‘GP3_M3’,home:‘r:C:2’,away:‘r:E:1’}] },
{ id:‘GP4’, slots:[‘r:B:2’,‘r:E:2’,‘r:A:2’], winRef:‘W4’,
matches:[{id:‘GP4_M1’,home:‘r:B:2’,away:‘r:E:2’},{id:‘GP4_M2’,home:‘r:E:2’,away:‘r:A:2’},{id:‘GP4_M3’,home:‘r:B:2’,away:‘r:A:2’}] },
],
rounds: [
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W3’,winRef:‘WF1’},
{id:‘SF2’,home:‘W2’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
best3: { groups:[‘A’,‘B’,‘C’,‘D’,‘E’], count:2 },
}
},
22: {
groups: [
{ label: ‘A’, slots: [‘A1’,‘A2’,‘A3’,‘A4’] },
{ label: ‘B’, slots: [‘B1’,‘B2’,‘B3’,‘B4’] },
{ label: ‘C’, slots: [‘C1’,‘C2’,‘C3’,‘C4’] },
{ label: ‘D’, slots: [‘D1’,‘D2’,‘D3’,‘D4’] },
{ label: ‘E’, slots: [‘E1’,‘E2’,‘E3’] },
{ label: ‘F’, slots: [‘F1’,‘F2’,‘F3’] },
],
groupMatches: [
{id:‘G1’,home:‘A1’,away:‘A2’},{id:‘G2’,home:‘A3’,away:‘A4’},
{id:‘G3’,home:‘B1’,away:‘B2’},{id:‘G4’,home:‘B3’,away:‘B4’},
{id:‘G5’,home:‘C1’,away:‘C2’},{id:‘G6’,home:‘C3’,away:‘C4’},
{id:‘G7’,home:‘D1’,away:‘D2’},{id:‘G8’,home:‘D3’,away:‘D4’},
{id:‘G9’,home:‘E1’,away:‘E2’},{id:‘G10’,home:‘F1’,away:‘F2’},
{id:‘G11’,home:‘A1’,away:‘A3’},{id:‘G12’,home:‘A2’,away:‘A4’},
{id:‘G13’,home:‘B1’,away:‘B3’},{id:‘G14’,home:‘B2’,away:‘B4’},
{id:‘G15’,home:‘C1’,away:‘C3’},{id:‘G16’,home:‘C2’,away:‘C4’},
{id:‘G17’,home:‘D1’,away:‘D3’},{id:‘G18’,home:‘D2’,away:‘D4’},
{id:‘G19’,home:‘E1’,away:‘E3’},{id:‘G20’,home:‘F1’,away:‘F3’},
{id:‘G21’,home:‘A1’,away:‘A4’},{id:‘G22’,home:‘A2’,away:‘A3’},
{id:‘G23’,home:‘B1’,away:‘B4’},{id:‘G24’,home:‘B2’,away:‘B3’},
{id:‘G25’,home:‘C1’,away:‘C4’},{id:‘G26’,home:‘C2’,away:‘C3’},
{id:‘G27’,home:‘D1’,away:‘D4’},{id:‘G28’,home:‘D2’,away:‘D3’},
{id:‘G29’,home:‘E2’,away:‘E3’},{id:‘G30’,home:‘F2’,away:‘F3’},
],
playoffs: {
rounds: [
{ name:‘Åttondelsfinal’, matches:[
{id:‘R16_1’,home:‘r:B:1’,away:‘r:A:3’,winRef:‘R1’},
{id:‘R16_2’,home:‘r:A:1’,away:‘r:C:2’,winRef:‘R2’},
{id:‘R16_3’,home:‘r:F:1’,away:‘r:C:3’,winRef:‘R3’},
{id:‘R16_4’,home:‘r:D:2’,away:‘r:E:2’,winRef:‘R4’},
{id:‘R16_5’,home:‘r:E:1’,away:‘r:B:3’,winRef:‘R5’},
{id:‘R16_6’,home:‘r:D:1’,away:‘r:F:2’,winRef:‘R6’},
{id:‘R16_7’,home:‘r:C:1’,away:‘r:D:3’,winRef:‘R7’},
{id:‘R16_8’,home:‘r:A:2’,away:‘r:B:2’,winRef:‘R8’},
]},
{ name:‘Kvartsfinaler’, matches:[
{id:‘QF1’,home:‘R1’,away:‘R2’,winRef:‘W1’},
{id:‘QF2’,home:‘R3’,away:‘R4’,winRef:‘W2’},
{id:‘QF3’,home:‘R5’,away:‘R6’,winRef:‘W3’},
{id:‘QF4’,home:‘R7’,away:‘R8’,winRef:‘W4’},
]},
{ name:‘Semifinaler’, matches:[
{id:‘SF1’,home:‘W1’,away:‘W2’,winRef:‘WF1’},
{id:‘SF2’,home:‘W3’,away:‘W4’,winRef:‘WF2’},
]},
{ name:‘Final’, matches:[{id:‘FIN’,home:‘WF1’,away:‘WF2’,winRef:null}]},
],
}
},
};

// ============================================================
// HELPERS
// ============================================================
const FLAG_BASE = ‘https://raw.githubusercontent.com/enkeldesign/webb/main/bords/flags/’;

function flagUrl(nation) {
return FLAG_BASE + encodeURIComponent(nation.toLowerCase()) + ‘.svg’;
}

function parseMarathon(md) {
const lines = md.split(’\n’).filter(l => l.startsWith(’|’) && !l.startsWith(’| :’) && !l.startsWith(’| Placering’));
return lines.map(line => {
const cols = line.split(’|’).map(c => c.trim()).filter(Boolean);
if (cols.length < 9) return null;
return {
rank: parseInt(cols[0]),
nation: cols[1],
tournaments: parseInt(cols[2]),
matches: parseInt(cols[3]),
wins: parseInt(cols[4]),
draws: parseInt(cols[5].replace(’*’,’’)),
losses: parseInt(cols[6]),
goalDiff: cols[7],
points: parseInt(cols[8]),
};
}).filter(Boolean);
}

function calcGroupStandings(groupSlots, assignments, results) {
// Build team stats for each slot in this group
const stats = {};
groupSlots.forEach(slot => {
const team = assignments[slot];
if (team) stats[slot] = { team, p:0, w:0, d:0, l:0, gf:0, ga:0 };
});

Object.entries(results).forEach(([matchId, res]) => {
const { homeSlot, awaySlot, homeGoals, awayGoals } = res;
if (!stats[homeSlot] || !stats[awaySlot]) return;
const hg = parseInt(homeGoals), ag = parseInt(awayGoals);
if (isNaN(hg) || isNaN(ag)) return;
stats[homeSlot].p += hg > ag ? 3 : hg === ag ? 1 : 0;
stats[homeSlot].w += hg > ag ? 1 : 0;
stats[homeSlot].d += hg === ag ? 1 : 0;
stats[homeSlot].l += hg < ag ? 1 : 0;
stats[homeSlot].gf += hg; stats[homeSlot].ga += ag;
stats[awaySlot].p += ag > hg ? 3 : hg === ag ? 1 : 0;
stats[awaySlot].w += ag > hg ? 1 : 0;
stats[awaySlot].d += hg === ag ? 1 : 0;
stats[awaySlot].l += ag > hg ? 1 : 0;
stats[awaySlot].gf += ag; stats[awaySlot].ga += hg;
});

return Object.values(stats).sort((a,b) =>
(b.p - a.p) || ((b.gf-b.ga) - (a.gf-a.ga)) || (b.gf - a.gf)
);
}

function getBest3(groups, assignments, results, count) {
const thirds = [];
groups.forEach(gl => {
const group = RULESETS[Object.keys(RULESETS)[0]]; // placeholder - we pass in actual group
// Will be called with actual standings
});
return thirds.slice(0, count);
}

function resolveSlot(ref, groupStandings, best3, playoffResults) {
// ref format: ‘r:A:1’ = rank 1 in group A
//             ‘b3:1’ = 1st best third
//             ‘V1’,‘W1’,‘WF1’ etc = playoff winner refs
if (!ref) return ‘?’;
if (ref.startsWith(‘r:’)) {
const [, grp, rank] = ref.split(’:’);
const standings = groupStandings[grp];
if (!standings) return `${grp}${rank}`;
const team = standings[parseInt(rank)-1];
return team ? team.team : `${grp}${rank}?`;
}
if (ref.startsWith(‘b3:’)) {
const idx = parseInt(ref.split(’:’)[1]) - 1;
return best3[idx] ? best3[idx].team : `B3-${idx+1}?`;
}
// playoff winner reference
if (playoffResults[ref]) return playoffResults[ref];
return ref;
}

function getHistory(team1, team2, historik) {
return historik.filter(m =>
(m.team1 === team1 && m.team2 === team2) ||
(m.team1 === team2 && m.team2 === team1)
).sort((a,b) => b.year - a.year).slice(0, 5);
}

// ============================================================
// COMPONENTS
// ============================================================

function Flag({ nation, size = 24 }) {
const [error, setError] = useState(false);
if (error || !nation) return (
<span style={{
width: size, height: Math.round(size*0.67),
background: ‘#e5e7eb’, borderRadius: 2, display:‘inline-flex’,
alignItems:‘center’, justifyContent:‘center’, fontSize: size*0.35,
fontWeight:‘bold’, color:’#9ca3af’, flexShrink:0
}}>{nation ? nation.slice(0,2).toUpperCase() : ‘?’}</span>
);
return (
<img
src={flagUrl(nation)}
alt={nation}
width={size}
height={Math.round(size*0.67)}
style={{ objectFit:‘cover’, borderRadius:2, flexShrink:0 }}
onError={() => setError(true)}
/>
);
}

function MatchCard({ homeTeam, awayTeam, matchId, result, onSave, historik, locked=false, compact=false }) {
const [homeInput, setHomeInput] = useState(’’);
const [awayInput, setAwayInput] = useState(’’);
const [editing, setEditing] = useState(false);
const hist = useMemo(() => getHistory(homeTeam, awayTeam, historik), [homeTeam, awayTeam, historik]);

useEffect(() => {
if (result) {
setHomeInput(String(result.homeGoals));
setAwayInput(String(result.awayGoals));
}
}, [result]);

const hasResult = result && result.homeGoals !== ‘’ && result.awayGoals !== ‘’;
const isEditing = editing || (!hasResult && !locked);

const handleSave = () => {
if (homeInput === ‘’ || awayInput === ‘’) return;
onSave(matchId, homeInput, awayInput);
setEditing(false);
};

return (
<div style={{
background: hasResult ? ‘#f0fdf4’ : ‘white’,
border: `1px solid ${hasResult ? '#86efac' : '#e5e7eb'}`,
borderRadius: 10, padding: compact ? ‘8px 12px’ : ‘12px 16px’,
marginBottom: 8,
}}>
<div style={{ display:‘flex’, alignItems:‘center’, gap: 10 }}>
<div style={{ flex:1, display:‘flex’, alignItems:‘center’, gap:8 }}>
<Flag nation={homeTeam} size={compact?20:24} />
<span style={{ fontSize: compact?13:14, fontWeight:600 }}>{homeTeam || ‘?’}</span>
</div>

```
    {isEditing ? (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <input
          type="number" min="0" max="99"
          value={homeInput}
          onChange={e=>setHomeInput(e.target.value)}
          style={{ width:48, textAlign:'center', border:'1px solid #d1d5db', borderRadius:6, padding:'4px', fontSize:16, fontWeight:'bold' }}
        />
        <span style={{ color:'#9ca3af', fontWeight:'bold' }}>–</span>
        <input
          type="number" min="0" max="99"
          value={awayInput}
          onChange={e=>setAwayInput(e.target.value)}
          style={{ width:48, textAlign:'center', border:'1px solid #d1d5db', borderRadius:6, padding:'4px', fontSize:16, fontWeight:'bold' }}
        />
      </div>
    ) : (
      <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:80, justifyContent:'center' }}>
        <span style={{ fontSize:18, fontWeight:'bold', color: hasResult?'#166534':'#9ca3af' }}>
          {hasResult ? `${result.homeGoals} – ${result.awayGoals}` : 'vs'}
        </span>
      </div>
    )}

    <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
      <span style={{ fontSize: compact?13:14, fontWeight:600 }}>{awayTeam || '?'}</span>
      <Flag nation={awayTeam} size={compact?20:24} />
    </div>
  </div>

  {!compact && hist.length > 0 && (
    <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
      {hist.map((h,i) => {
        const s1 = h.team1===homeTeam ? h.score1 : h.score2;
        const s2 = h.team1===homeTeam ? h.score2 : h.score1;
        return (
          <span key={i} style={{
            fontSize:11, padding:'2px 6px', borderRadius:10,
            background: s1>s2?'#dcfce7':s1<s2?'#fee2e2':'#f3f4f6',
            color: s1>s2?'#166534':s1<s2?'#991b1b':'#374151'
          }}>{h.year}: {s1}–{s2}{h.note?` (${h.note})`:''}</span>
        );
      })}
    </div>
  )}

  {!locked && (
    <div style={{ marginTop:6, display:'flex', justifyContent:'flex-end', gap:6 }}>
      {isEditing ? (
        <button onClick={handleSave} disabled={homeInput===''||awayInput===''}
          style={{ padding:'4px 14px', background:'#22c55e', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:'bold', fontSize:13 }}>
          Klar
        </button>
      ) : (
        <button onClick={()=>{setEditing(true)}}
          style={{ padding:'4px 14px', background:'#f3f4f6', color:'#374151', border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer', fontSize:13 }}>
          Ändra
        </button>
      )}
    </div>
  )}
</div>
```

);
}

function GroupTable({ label, slots, assignments, standings }) {
return (
<div style={{ marginBottom:16, borderRadius:10, overflow:‘hidden’, border:‘1px solid #e5e7eb’ }}>
<div style={{ background:’#1e40af’, color:‘white’, padding:‘6px 12px’, fontWeight:‘bold’, fontSize:14 }}>
Grupp {label}
</div>
<table style={{ width:‘100%’, borderCollapse:‘collapse’, fontSize:13 }}>
<thead>
<tr style={{ background:’#eff6ff’ }}>
<th style={{ padding:‘4px 8px’, textAlign:‘left’ }}>#</th>
<th style={{ padding:‘4px 8px’, textAlign:‘left’ }}>Lag</th>
<th style={{ padding:‘4px 4px’, textAlign:‘center’ }}>M</th>
<th style={{ padding:‘4px 4px’, textAlign:‘center’ }}>V</th>
<th style={{ padding:‘4px 4px’, textAlign:‘center’ }}>O</th>
<th style={{ padding:‘4px 4px’, textAlign:‘center’ }}>F</th>
<th style={{ padding:‘4px 4px’, textAlign:‘center’ }}>Mål</th>
<th style={{ padding:‘4px 8px’, textAlign:‘center’, fontWeight:‘bold’ }}>P</th>
</tr>
</thead>
<tbody>
{standings.map((s, i) => (
<tr key={i} style={{ background: i<2?’#f0fdf4’:i===2?’#fefce8’:‘white’, borderTop:‘1px solid #f3f4f6’ }}>
<td style={{ padding:‘5px 8px’, color:’#9ca3af’ }}>{i+1}</td>
<td style={{ padding:‘5px 8px’ }}>
<div style={{ display:‘flex’, alignItems:‘center’, gap:6 }}>
<Flag nation={s.team} size={18} />
<span style={{ fontWeight:500 }}>{s.team}</span>
</div>
</td>
<td style={{ textAlign:‘center’, padding:‘5px 4px’ }}>{s.w+s.d+s.l}</td>
<td style={{ textAlign:‘center’, padding:‘5px 4px’ }}>{s.w}</td>
<td style={{ textAlign:‘center’, padding:‘5px 4px’ }}>{s.d}</td>
<td style={{ textAlign:‘center’, padding:‘5px 4px’ }}>{s.l}</td>
<td style={{ textAlign:‘center’, padding:‘5px 4px’ }}>{s.gf}–{s.ga}</td>
<td style={{ textAlign:‘center’, padding:‘5px 8px’, fontWeight:‘bold’, color:’#1e40af’ }}>{s.p}</td>
</tr>
))}
</tbody>
</table>
</div>
);
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
const [phase, setPhase] = useState(‘setup’);
const [n, setN] = useState(16);
const [t, setT] = useState(2);
const [selectedNations, setSelectedNations] = useState([]);
const [assignments, setAssignments] = useState({}); // slot -> nation
const [groupResults, setGroupResults] = useState({}); // matchId -> {homeSlot,awaySlot,homeGoals,awayGoals}
const [playoffResults, setPlayoffResults] = useState({}); // winRef -> nation
const [playoffScores, setPlayoffScores] = useState({}); // matchId -> {homeGoals,awayGoals}
const [miniGroupResults, setMiniGroupResults] = useState({});
const [tab, setTab] = useState(0);
const [historik, setHistorik] = useState([]);
const [marathonBase, setMarathonBase] = useState([]);
const [allNations, setAllNations] = useState([]);
const [nationSearch, setNationSearch] = useState(’’);
const [loading, setLoading] = useState(true);
const [dragNation, setDragNation] = useState(null);
const [newNation, setNewNation] = useState(’’);
const [saveStatus, setSaveStatus] = useState(’’);

const ruleset = RULESETS[n];
const allSlots = ruleset ? ruleset.groups.flatMap(g => g.slots) : [];

// Load external data
useEffect(() => {
Promise.all([
fetch(‘https://enkel.design/bords/database/historik.json’).then(r=>r.json()),
fetch(‘https://enkel.design/bords/database/marathon.md’).then(r=>r.text()),
]).then(([hist, marathonMd]) => {
setHistorik(hist.matches || []);
setMarathonBase(parseMarathon(marathonMd));
// Extract unique nations
const nationsSet = new Set();
hist.matches.forEach(m => { nationsSet.add(m.team1); nationsSet.add(m.team2); });
setAllNations([…nationsSet].sort());
setLoading(false);
}).catch(() => {
setLoading(false);
});
}, []);

// Load saved state
useEffect(() => {
(async () => {
try {
const saved = await window.storage.get(‘tournament-state’);
if (saved) {
const st = JSON.parse(saved.value);
setPhase(st.phase || ‘setup’);
setN(st.n || 16);
setT(st.t || 2);
setSelectedNations(st.selectedNations || []);
setAssignments(st.assignments || {});
setGroupResults(st.groupResults || {});
setPlayoffResults(st.playoffResults || {});
setPlayoffScores(st.playoffScores || {});
setMiniGroupResults(st.miniGroupResults || {});
}
} catch(e) {}
})();
}, []);

// Auto-save state
const saveState = useCallback(async (state) => {
try {
await window.storage.set(‘tournament-state’, JSON.stringify(state));
setSaveStatus(‘Sparat ✓’);
setTimeout(() => setSaveStatus(’’), 2000);
} catch(e) {}
}, []);

useEffect(() => {
if (phase !== ‘setup’) {
saveState({ phase, n, t, selectedNations, assignments, groupResults, playoffResults, playoffScores, miniGroupResults });
}
}, [phase, n, t, selectedNations, assignments, groupResults, playoffResults, playoffScores, miniGroupResults]);

// Calculate group standings for all groups
const groupStandings = useMemo(() => {
if (!ruleset) return {};
const result = {};
ruleset.groups.forEach(g => {
result[g.label] = calcGroupStandings(g.slots, assignments, groupResults);
});
return result;
}, [ruleset, assignments, groupResults]);

// Calculate best third-place teams
const best3 = useMemo(() => {
if (!ruleset?.playoffs?.best3) return [];
const { groups, count } = ruleset.playoffs.best3;
const thirds = groups.map(gl => {
const standings = groupStandings[gl];
if (!standings || standings.length < 3) return null;
return standings[2];
}).filter(Boolean);
return thirds.sort((a,b) => (b.p-a.p)||((b.gf-b.ga)-(a.gf-a.ga))||(b.gf-a.gf)).slice(0, count);
}, [ruleset, groupStandings]);

// Resolve a playoff ref to an actual team name
const resolveRef = useCallback((ref) => {
if (!ref) return ‘?’;
if (ref.startsWith(‘r:’)) {
const [,grp,rank] = ref.split(’:’);
const standings = groupStandings[grp];
if (!standings || standings.length < parseInt(rank)) return `${grp}${rank}?`;
return standings[parseInt(rank)-1]?.team || ‘?’;
}
if (ref.startsWith(‘b3:’)) {
const idx = parseInt(ref.split(’:’)[1])-1;
return best3[idx]?.team || `B3-${idx+1}?`;
}
if (playoffResults[ref]) return playoffResults[ref];
return ref;
}, [groupStandings, best3, playoffResults]);

// Check if all group matches played
const groupMatchCount = ruleset ? ruleset.groupMatches.length : 0;
const playedGroupMatches = Object.keys(groupResults).length;
const groupStageDone = playedGroupMatches >= groupMatchCount;

// Group matches enriched with team names
const enrichedGroupMatches = useMemo(() => {
if (!ruleset) return [];
return ruleset.groupMatches.map(m => ({
…m,
homeTeam: assignments[m.home] || m.home,
awayTeam: assignments[m.away] || m.away,
result: groupResults[m.id],
}));
}, [ruleset, assignments, groupResults]);

// Current/next t matches (unplayed)
const currentMatches = useMemo(() => {
const unplayed = enrichedGroupMatches.filter(m => !groupResults[m.id]);
return unplayed.slice(0, t);
}, [enrichedGroupMatches, groupResults, t]);

const handleGroupResult = useCallback((matchId, homeGoals, awayGoals) => {
const match = ruleset.groupMatches.find(m => m.id === matchId);
if (!match) return;
setGroupResults(prev => ({
…prev,
[matchId]: { homeSlot: match.home, awaySlot: match.away, homeGoals, awayGoals }
}));
}, [ruleset]);

// Marathon table (base + current tournament)
const updatedMarathon = useMemo(() => {
const base = […marathonBase];
// Add tournament results
const addResult = (teamName, isWin, isDraw, isLoss, gf, ga) => {
let entry = base.find(e => e.nation === teamName);
if (!entry) {
entry = { nation: teamName, tournaments:1, matches:0, wins:0, draws:0, losses:0, goalDiff:‘0-0’, points:0, _new:true };
base.push(entry);
} else {
entry = { …entry };
base[base.indexOf(base.find(e=>e.nation===teamName))] = entry;
}
entry.matches = (entry.matches||0) + 1;
entry.wins = (entry.wins||0) + (isWin?1:0);
entry.draws = (entry.draws||0) + (isDraw?1:0);
entry.losses = (entry.losses||0) + (isLoss?1:0);
entry.points = (entry.points||0) + (isWin?3:isDraw?1:0);
const [prevGF, prevGA] = (entry.goalDiff||‘0-0’).split(’-’).map(Number);
entry.goalDiff = `${prevGF+gf}-${prevGA+ga}`;
};

```
Object.values(groupResults).forEach(r => {
  const hTeam = assignments[r.homeSlot];
  const aTeam = assignments[r.awaySlot];
  const hg = parseInt(r.homeGoals), ag = parseInt(r.awayGoals);
  if (!hTeam || !aTeam || isNaN(hg) || isNaN(ag)) return;
  addResult(hTeam, hg>ag, hg===ag, hg<ag, hg, ag);
  addResult(aTeam, ag>hg, hg===ag, ag<hg, ag, hg);
});

return base.sort((a,b) => (b.points-a.points)||0);
```

}, [marathonBase, groupResults, assignments]);

// ======================== SETUP SCREEN ========================
if (phase === ‘setup’) {
const filteredNations = allNations.filter(n =>
n.toLowerCase().includes(nationSearch.toLowerCase()) &&
!selectedNations.includes(n)
);

```
return (
  <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1e3a8a 0%,#1e40af 50%,#1d4ed8 100%)', padding:20 }}>
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <h1 style={{ color:'white', fontSize:28, fontWeight:'bold', textAlign:'center', marginBottom:4 }}>
        🏒 Bordhockey-turnering
      </h1>
      <p style={{ color:'#93c5fd', textAlign:'center', marginBottom:24 }}>Konfigurera turnering</p>

      <div style={{ background:'white', borderRadius:16, padding:24, marginBottom:16 }}>
        <h2 style={{ fontWeight:'bold', marginBottom:16, color:'#1e3a8a' }}>Inställningar</h2>
        <div style={{ display:'flex', gap:16, marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:13, color:'#6b7280', display:'block', marginBottom:4 }}>Antal deltagare</label>
            <select value={n} onChange={e=>setN(parseInt(e.target.value))}
              style={{ width:'100%', padding:'8px 12px', border:'2px solid #e5e7eb', borderRadius:8, fontSize:15, fontWeight:'bold' }}>
              {[12,13,14,15,16,17,18,19,20,21,22].map(v=>(
                <option key={v} value={v}>{v} lag</option>
              ))}
            </select>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:13, color:'#6b7280', display:'block', marginBottom:4 }}>Antal bord (t)</label>
            <select value={t} onChange={e=>setT(parseInt(e.target.value))}
              style={{ width:'100%', padding:'8px 12px', border:'2px solid #e5e7eb', borderRadius:8, fontSize:15, fontWeight:'bold' }}>
              {[1,2,3,4,5,6].map(v=>(
                <option key={v} value={v}>{v} {v===1?'bord':'bord'}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ background:'#eff6ff', borderRadius:10, padding:12, fontSize:13, color:'#1e40af' }}>
          {n} lag → {ruleset?.groups.length} grupper med {ruleset?.groups.map(g=>g.slots.length).join('/')} lag
          {' '}· {groupMatchCount} gruppspelsmatcher · {t} parallella matcher
        </div>
      </div>

      <div style={{ background:'white', borderRadius:16, padding:24, marginBottom:16 }}>
        <h2 style={{ fontWeight:'bold', marginBottom:4, color:'#1e3a8a' }}>
          Välj nationer ({selectedNations.length}/{n})
        </h2>
        <p style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>Välj exakt {n} nationer som deltar</p>

        {selectedNations.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Valda nationer:</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {selectedNations.map(nat => (
                <div key={nat} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'4px 8px 4px 6px',
                  background:'#dbeafe', borderRadius:20, fontSize:13
                }}>
                  <Flag nation={nat} size={16} />
                  <span>{nat}</span>
                  <button onClick={()=>setSelectedNations(prev=>prev.filter(x=>x!==nat))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#2563eb', padding:0, fontWeight:'bold', fontSize:14 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input
            placeholder="Sök nation..."
            value={nationSearch}
            onChange={e=>setNationSearch(e.target.value)}
            style={{ flex:1, padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8 }}
          />
          <input
            placeholder="Ny nation..."
            value={newNation}
            onChange={e=>setNewNation(e.target.value)}
            onKeyDown={e=>{
              if (e.key==='Enter' && newNation.trim()) {
                const name = newNation.trim();
                if (!allNations.includes(name)) setAllNations(prev=>[...prev,name].sort());
                if (!selectedNations.includes(name) && selectedNations.length < n)
                  setSelectedNations(prev=>[...prev, name]);
                setNewNation('');
              }
            }}
            style={{ width:140, padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8 }}
          />
        </div>

        <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexWrap:'wrap', gap:6 }}>
          {filteredNations.slice(0,80).map(nat => (
            <div
              key={nat}
              onClick={()=>{
                if (selectedNations.length < n && !selectedNations.includes(nat))
                  setSelectedNations(prev=>[...prev, nat]);
              }}
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
                border:'1px solid #e5e7eb', borderRadius:20, cursor:'pointer', fontSize:13,
                background: selectedNations.length >= n ? '#f9fafb' : 'white',
                opacity: selectedNations.length >= n ? 0.5 : 1,
                transition:'all 0.15s'
              }}
            >
              <Flag nation={nat} size={16} />
              {nat}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={()=>setPhase('draw')}
        disabled={selectedNations.length !== n}
        style={{
          width:'100%', padding:'14px', fontSize:16, fontWeight:'bold',
          background: selectedNations.length === n ? '#22c55e' : '#d1d5db',
          color:'white', border:'none', borderRadius:12, cursor: selectedNations.length===n?'pointer':'not-allowed',
          transition:'all 0.2s'
        }}
      >
        {selectedNations.length === n ? 'Gå till lottning →' : `Välj ${n - selectedNations.length} till`}
      </button>
    </div>
  </div>
);
```

}

// ======================== DRAW SCREEN ========================
if (phase === ‘draw’) {
const unassigned = selectedNations.filter(nat => !Object.values(assignments).includes(nat));
const allAssigned = ruleset.groups.every(g => g.slots.every(s => assignments[s]));

```
return (
  <div style={{ minHeight:'100vh', background:'#f8fafc', padding:20 }}>
    <div style={{ maxWidth:800, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={()=>setPhase('setup')}
          style={{ padding:'6px 14px', border:'1px solid #e5e7eb', borderRadius:8, background:'white', cursor:'pointer' }}>
          ← Tillbaka
        </button>
        <h1 style={{ fontSize:22, fontWeight:'bold', color:'#1e3a8a' }}>Gruppindelning (Lottning)</h1>
      </div>

      <div style={{ background:'#fef3c7', borderRadius:12, padding:12, marginBottom:16, fontSize:13, color:'#92400e' }}>
        ℹ️ Lottningen görs manuellt (utanför appen). Dra eller klicka nationerna till rätt grupplats nedan.
      </div>

      {/* Unassigned nations */}
      {unassigned.length > 0 && (
        <div style={{ background:'white', borderRadius:12, padding:16, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontWeight:'bold', marginBottom:10, color:'#374151' }}>Ej placerade lag ({unassigned.length})</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {unassigned.map(nat => (
              <div
                key={nat}
                draggable
                onDragStart={()=>setDragNation(nat)}
                onClick={()=>setDragNation(dragNation===nat?null:nat)}
                style={{
                  display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
                  border: dragNation===nat?'2px solid #2563eb':'2px solid #e5e7eb',
                  borderRadius:20, cursor:'grab', fontSize:13, background: dragNation===nat?'#dbeafe':'white',
                  fontWeight: dragNation===nat?'bold':'normal'
                }}
              >
                <Flag nation={nat} size={18} />
                {nat}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
        {ruleset.groups.map(group => (
          <div key={group.label} style={{ background:'white', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ background:'#1e40af', color:'white', padding:'8px 14px', fontWeight:'bold' }}>
              Grupp {group.label}
            </div>
            <div style={{ padding:10 }}>
              {group.slots.map((slot, i) => {
                const team = assignments[slot];
                return (
                  <div
                    key={slot}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={()=>{
                      if (!dragNation) return;
                      setAssignments(prev => {
                        const next = {...prev};
                        // If slot occupied, swap
                        if (next[slot]) {
                          const oldSlot = Object.keys(next).find(k=>next[k]===dragNation);
                          if (oldSlot) next[oldSlot] = next[slot];
                          else delete next[slot];
                        }
                        next[slot] = dragNation;
                        return next;
                      });
                      setDragNation(null);
                    }}
                    onClick={()=>{
                      if (dragNation) {
                        setAssignments(prev => {
                          const next = {...prev};
                          const oldSlot = Object.keys(next).find(k=>next[k]===dragNation);
                          if (next[slot] && dragNation !== next[slot]) {
                            if (oldSlot) next[oldSlot] = next[slot];
                          }
                          next[slot] = dragNation;
                          return next;
                        });
                        setDragNation(null);
                      } else if (team) {
                        setAssignments(prev=>{const n={...prev};delete n[slot];return n;});
                      }
                    }}
                    style={{
                      display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                      borderRadius:8, marginBottom:4, cursor:'pointer', minHeight:38,
                      background: team ? '#f0fdf4' : '#f9fafb',
                      border: '1px dashed #d1d5db',
                      transition:'all 0.1s'
                    }}
                  >
                    <span style={{ fontSize:11, color:'#9ca3af', minWidth:20 }}>{slot}</span>
                    {team ? (
                      <>
                        <Flag nation={team} size={18} />
                        <span style={{ fontSize:13, fontWeight:500 }}>{team}</span>
                      </>
                    ) : (
                      <span style={{ fontSize:12, color:'#d1d5db' }}>Klicka / dra hit</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:12, marginTop:20 }}>
        <button
          onClick={()=>{ setAssignments({}); }}
          style={{ padding:'10px 20px', border:'1px solid #e5e7eb', borderRadius:10, background:'white', cursor:'pointer' }}>
          Återställ
        </button>
        <button
          onClick={()=>{
            // Auto-assign remaining randomly for quick testing
            const slots = ruleset.groups.flatMap(g=>g.slots).filter(s=>!assignments[s]);
            const nations = [...unassigned];
            const newAssign = {...assignments};
            slots.forEach((s,i)=>{ if(nations[i]) newAssign[s]=nations[i]; });
            setAssignments(newAssign);
          }}
          style={{ padding:'10px 20px', border:'1px solid #e5e7eb', borderRadius:10, background:'white', cursor:'pointer' }}>
          Auto-fördela resterande
        </button>
        <button
          onClick={()=>{ if(allAssigned) setPhase('tournament'); }}
          disabled={!allAssigned}
          style={{
            flex:1, padding:'12px', fontSize:16, fontWeight:'bold',
            background: allAssigned ? '#22c55e' : '#d1d5db',
            color:'white', border:'none', borderRadius:10, cursor: allAssigned?'pointer':'not-allowed'
          }}
        >
          {allAssigned ? 'Starta turnering! 🏒' : `${Object.values(assignments).filter(Boolean).length}/${n} placerade`}
        </button>
      </div>
    </div>
  </div>
);
```

}

// ======================== TOURNAMENT SCREEN ========================
const tabs = [‘🏒 Matcher & Tabeller’, ‘🏆 Slutspel’, ‘📊 Maratontabell’];

// Playoff helpers
const allGroupMatchesForCurrentMatches = enrichedGroupMatches.filter(m=>!groupResults[m.id]);
const nextGroupMatches = allGroupMatchesForCurrentMatches.slice(0, t);
const ongoingGroupMatches = enrichedGroupMatches.filter(m=>groupResults[m.id]).slice(-t);

return (
<div style={{ minHeight:‘100vh’, background:’#f1f5f9’, fontFamily:‘system-ui,sans-serif’ }}>
{/* Header */}
<div style={{ background:’#1e3a8a’, padding:‘12px 20px’, display:‘flex’, alignItems:‘center’, justifyContent:‘space-between’ }}>
<div style={{ display:‘flex’, alignItems:‘center’, gap:12 }}>
<span style={{ fontSize:20, fontWeight:‘bold’, color:‘white’ }}>🏒 Bordhockey {n}p</span>
<span style={{ fontSize:12, color:’#93c5fd’ }}>{t} bord</span>
</div>
<div style={{ display:‘flex’, gap:6, alignItems:‘center’ }}>
{saveStatus && <span style={{ color:’#86efac’, fontSize:12 }}>{saveStatus}</span>}
<button onClick={()=>setPhase(‘setup’)}
style={{ padding:‘4px 12px’, background:‘rgba(255,255,255,0.15)’, border:‘1px solid rgba(255,255,255,0.3)’, color:‘white’, borderRadius:8, cursor:‘pointer’, fontSize:12 }}>
Ny turnering
</button>
</div>
</div>

```
  {/* Tabs */}
  <div style={{ background:'white', display:'flex', borderBottom:'1px solid #e5e7eb' }}>
    {tabs.map((label, i) => (
      <button
        key={i}
        onClick={()=>{ if(i!==1 || groupStageDone) setTab(i); }}
        disabled={i===1 && !groupStageDone}
        style={{
          padding:'12px 18px', border:'none', borderBottom: tab===i?'3px solid #2563eb':'3px solid transparent',
          background:'none', fontWeight: tab===i?'bold':'normal', color: tab===i?'#2563eb':i===1&&!groupStageDone?'#d1d5db':'#374151',
          cursor: i===1&&!groupStageDone?'not-allowed':'pointer', fontSize:14
        }}
      >
        {label}
        {i===1 && !groupStageDone && <span style={{ marginLeft:4, fontSize:11, color:'#d1d5db' }}>(Låst)</span>}
      </button>
    ))}
  </div>

  <div style={{ maxWidth:900, margin:'0 auto', padding:'16px 16px' }}>

    {/* =========== TAB 0: GAMES & TABLES =========== */}
    {tab === 0 && (
      <div>
        <div style={{ background:'white', borderRadius:12, padding:16, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{ fontWeight:'bold', color:'#1e3a8a', margin:0 }}>
              {groupStageDone ? '✅ Gruppspelet klart!' : `Pågående / Nästa matcher (${nextGroupMatches.length} av ${t} bord)`}
            </h2>
            {!groupStageDone && (
              <span style={{ fontSize:13, color:'#6b7280' }}>
                {playedGroupMatches}/{groupMatchCount} spelade
              </span>
            )}
          </div>

          {!groupStageDone ? (
            nextGroupMatches.map(m => (
              <MatchCard
                key={m.id}
                homeTeam={m.homeTeam}
                awayTeam={m.awayTeam}
                matchId={m.id}
                result={m.result}
                onSave={handleGroupResult}
                historik={historik}
              />
            ))
          ) : (
            <div style={{ color:'#166534', fontWeight:'bold', textAlign:'center', padding:'12px 0' }}>
              Alla {groupMatchCount} gruppspelsmatcher spelade! 🎉 Gå till Slutspel-fliken.
            </div>
          )}
        </div>

        {/* Upcoming matches accordion */}
        {!groupStageDone && allGroupMatchesForCurrentMatches.length > t && (
          <details style={{ background:'white', borderRadius:12, padding:16, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <summary style={{ fontWeight:'bold', color:'#374151', cursor:'pointer' }}>
              Kommande matcher ({allGroupMatchesForCurrentMatches.length - t} kvar)
            </summary>
            <div style={{ marginTop:12 }}>
              {allGroupMatchesForCurrentMatches.slice(t, t+10).map(m => (
                <MatchCard key={m.id} homeTeam={m.homeTeam} awayTeam={m.awayTeam} matchId={m.id}
                  result={m.result} onSave={handleGroupResult} historik={historik} compact />
              ))}
            </div>
          </details>
        )}

        {/* All group matches (played) */}
        {playedGroupMatches > 0 && (
          <details style={{ background:'white', borderRadius:12, padding:16, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <summary style={{ fontWeight:'bold', color:'#374151', cursor:'pointer' }}>
              Spelade matcher ({playedGroupMatches})
            </summary>
            <div style={{ marginTop:12 }}>
              {enrichedGroupMatches.filter(m=>groupResults[m.id]).map(m => (
                <MatchCard key={m.id} homeTeam={m.homeTeam} awayTeam={m.awayTeam} matchId={m.id}
                  result={m.result} onSave={handleGroupResult} historik={historik} compact />
              ))}
            </div>
          </details>
        )}

        {/* Group standings */}
        <h2 style={{ fontWeight:'bold', color:'#1e3a8a', marginTop:8, marginBottom:12 }}>Grupptabeller</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {ruleset.groups.map(g => (
            <GroupTable
              key={g.label}
              label={g.label}
              slots={g.slots}
              assignments={assignments}
              standings={groupStandings[g.label] || []}
            />
          ))}
        </div>

        {/* Best thirds info */}
        {ruleset.playoffs?.best3 && best3.length > 0 && (
          <div style={{ background:'#fef9c3', borderRadius:10, padding:12, marginTop:12, fontSize:13 }}>
            <strong>Vidare via bästa trea:</strong>
            {best3.map((t3,i) => (
              <span key={i} style={{ marginLeft:10 }}>
                {i+1}. {t3.team} ({t3.p}p, {t3.gf}–{t3.ga})
              </span>
            ))}
          </div>
        )}
      </div>
    )}

    {/* =========== TAB 1: PLAYOFFS =========== */}
    {tab === 1 && groupStageDone && (
      <PlayoffTab
        ruleset={ruleset}
        resolveRef={resolveRef}
        playoffScores={playoffScores}
        playoffResults={playoffResults}
        historik={historik}
        miniGroupResults={miniGroupResults}
        onPlayoffResult={(matchId, homeGoals, awayGoals, homeRef, awayRef) => {
          const hg = parseInt(homeGoals), ag = parseInt(awayGoals);
          setPlayoffScores(prev=>({...prev,[matchId]:{homeGoals,awayGoals}}));
          // determine winner
          if (!isNaN(hg) && !isNaN(ag) && hg !== ag) {
            const homeTeam = resolveRef(homeRef);
            const awayTeam = resolveRef(awayRef);
            // find winRef for this match
            const allMatches = [
              ...(ruleset.playoffs.rounds || []).flatMap(r=>r.matches),
              ...(ruleset.playoffs.miniGroups||[]).flatMap(g=>g.matches),
            ];
            const matchDef = allMatches.find(m=>m.id===matchId);
            if (matchDef?.winRef) {
              setPlayoffResults(prev=>({...prev,[matchDef.winRef]: hg>ag?homeTeam:awayTeam}));
            }
          }
        }}
        onMiniGroupResult={(matchId, homeGoals, awayGoals, homeRef, awayRef) => {
          const hg = parseInt(homeGoals), ag = parseInt(awayGoals);
          setMiniGroupResults(prev=>({...prev,[matchId]:{homeRef,awayRef,homeGoals,awayGoals}}));
        }}
        assignments={assignments}
        groupStandings={groupStandings}
        best3={best3}
      />
    )}

    {/* =========== TAB 2: MARATHON =========== */}
    {tab === 2 && (
      <div>
        <h2 style={{ fontWeight:'bold', color:'#1e3a8a', marginBottom:12 }}>Maratontabell (löpande)</h2>
        <div style={{ background:'white', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#1e3a8a', color:'white' }}>
                <th style={{ padding:'8px 10px', textAlign:'left' }}>#</th>
                <th style={{ padding:'8px 10px', textAlign:'left' }}>Nation</th>
                <th style={{ padding:'8px 6px', textAlign:'center' }}>T</th>
                <th style={{ padding:'8px 6px', textAlign:'center' }}>M</th>
                <th style={{ padding:'8px 6px', textAlign:'center' }}>V</th>
                <th style={{ padding:'8px 6px', textAlign:'center' }}>O</th>
                <th style={{ padding:'8px 6px', textAlign:'center' }}>F</th>
                <th style={{ padding:'8px 6px', textAlign:'center' }}>Mål</th>
                <th style={{ padding:'8px 10px', textAlign:'center', fontWeight:'bold' }}>P</th>
              </tr>
            </thead>
            <tbody>
              {updatedMarathon.map((row, i) => (
                <tr key={row.nation} style={{ borderTop:'1px solid #f3f4f6', background: i%2===0?'white':'#f8fafc' }}>
                  <td style={{ padding:'6px 10px', color:'#9ca3af', fontSize:12 }}>{i+1}</td>
                  <td style={{ padding:'6px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Flag nation={row.nation} size={18} />
                      <span style={{ fontWeight: row._new?'bold':'normal', color: row._new?'#2563eb':'inherit' }}>
                        {row.nation}
                      </span>
                      {row._new && <span style={{ fontSize:10, color:'#2563eb', background:'#dbeafe', padding:'1px 5px', borderRadius:8 }}>NY</span>}
                    </div>
                  </td>
                  <td style={{ textAlign:'center', padding:'6px' }}>{row.tournaments||1}</td>
                  <td style={{ textAlign:'center', padding:'6px' }}>{row.matches||0}</td>
                  <td style={{ textAlign:'center', padding:'6px' }}>{row.wins||0}</td>
                  <td style={{ textAlign:'center', padding:'6px' }}>{row.draws||0}</td>
                  <td style={{ textAlign:'center', padding:'6px' }}>{row.losses||0}</td>
                  <td style={{ textAlign:'center', padding:'6px', fontSize:12 }}>{row.goalDiff||'0-0'}</td>
                  <td style={{ textAlign:'center', padding:'6px 10px', fontWeight:'bold', color:'#1e3a8a' }}>{row.points||0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
</div>
```

);
}

// ============================================================
// PLAYOFF TAB COMPONENT
// ============================================================
function PlayoffTab({ ruleset, resolveRef, playoffScores, playoffResults, historik, miniGroupResults, onPlayoffResult, onMiniGroupResult, assignments, groupStandings, best3 }) {

// For mini-group playoff (n=21), calculate mini-group standings
const calcMiniGroupStandings = (slots, matchDefs) => {
const stats = {};
slots.forEach(s => { stats[s] = { team: resolveRef(s), p:0,w:0,d:0,l:0,gf:0,ga:0 }; });
matchDefs.forEach(m => {
const r = miniGroupResults[m.id];
if (!r) return;
const hg = parseInt(r.homeGoals), ag = parseInt(r.awayGoals);
if (isNaN(hg)||isNaN(ag)) return;
const hs = m.home, as_ = m.away;
if (!stats[hs]||!stats[as_]) return;
stats[hs].p += hg>ag?3:hg===ag?1:0;
stats[hs].w += hg>ag?1:0; stats[hs].d += hg===ag?1:0; stats[hs].l += hg<ag?1:0;
stats[hs].gf += hg; stats[hs].ga += ag;
stats[as_].p += ag>hg?3:hg===ag?1:0;
stats[as_].w += ag>hg?1:0; stats[as_].d += hg===ag?1:0; stats[as_].l += ag<hg?1:0; // fix: l for away
stats[as_].gf += ag; stats[as_].ga += hg;
});
return Object.values(stats).sort((a,b)=>(b.p-a.p)||((b.gf-b.ga)-(a.gf-a.ga))||(b.gf-a.gf));
};

return (
<div>
{/* Mini-group playoffs (n=21) */}
{ruleset.playoffs?.miniGroups && (
<div style={{ marginBottom:20 }}>
<h2 style={{ fontWeight:‘bold’, color:’#1e3a8a’, marginBottom:12 }}>Gruppspel slutspel</h2>
<div style={{ display:‘grid’, gridTemplateColumns:‘repeat(auto-fill,minmax(320px,1fr))’, gap:16 }}>
{ruleset.playoffs.miniGroups.map(gp => {
const standings = calcMiniGroupStandings(gp.slots, gp.matches);
const winner = standings[0]?.p > standings[1]?.p || (standings.length>0 && gp.matches.every(m=>miniGroupResults[m.id])) ? standings[0]?.team : null;
return (
<div key={gp.id} style={{ background:‘white’, borderRadius:12, overflow:‘hidden’, boxShadow:‘0 1px 3px rgba(0,0,0,0.08)’ }}>
<div style={{ background:’#7c3aed’, color:‘white’, padding:‘8px 14px’, fontWeight:‘bold’ }}>
{gp.id} {winner ? `→ ${winner}` : ‘’}
</div>
<div style={{ padding:12 }}>
{gp.matches.map(m => {
const hTeam = resolveRef(m.home);
const aTeam = resolveRef(m.away);
const r = miniGroupResults[m.id];
return (
<MatchCard key={m.id} homeTeam={hTeam} awayTeam={aTeam} matchId={m.id}
result={r?{homeGoals:r.homeGoals,awayGoals:r.awayGoals}:null}
onSave={(id,hg,ag)=>onMiniGroupResult(id,hg,ag,m.home,m.away)}
historik={historik} compact />
);
})}
<table style={{ width:‘100%’, fontSize:12, marginTop:8, borderCollapse:‘collapse’ }}>
{standings.map((s,i)=>(
<tr key={i} style={{ borderTop:‘1px solid #f3f4f6’ }}>
<td style={{ padding:‘3px 4px’, color:’#9ca3af’ }}>{i+1}</td>
<td style={{ padding:‘3px 4px’ }}>
<div style={{ display:‘flex’, alignItems:‘center’, gap:4 }}>
<Flag nation={s.team} size={14} />
<span>{s.team}</span>
</div>
</td>
<td style={{ textAlign:‘center’, padding:‘3px 4px’ }}>{s.w}V {s.d}O {s.l}F</td>
<td style={{ textAlign:‘center’, padding:‘3px 4px’, fontWeight:‘bold’, color:’#7c3aed’ }}>{s.p}p</td>
</tr>
))}
</table>
</div>
</div>
);
})}
</div>
</div>
)}

```
  {/* Playoff rounds */}
  {(ruleset.playoffs?.rounds||[]).map((round, ri) => (
    <div key={ri} style={{ marginBottom:20 }}>
      <h2 style={{ fontWeight:'bold', color:'#1e3a8a', marginBottom:12 }}>{round.name}</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:12 }}>
        {round.matches.map(m => {
          const hTeam = resolveRef(m.home);
          const aTeam = resolveRef(m.away);
          const score = playoffScores[m.id];
          const isPending = hTeam.includes('?') || aTeam.includes('?');
          return (
            <div key={m.id} style={{ background:'white', borderRadius:12, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6 }}>Match {m.id}</div>
              <MatchCard
                homeTeam={isPending?'?':hTeam}
                awayTeam={isPending?'?':aTeam}
                matchId={m.id}
                result={score}
                onSave={(id,hg,ag)=>onPlayoffResult(id,hg,ag,m.home,m.away)}
                historik={historik}
                locked={isPending}
              />
              {m.winRef && playoffResults[m.winRef] && (
                <div style={{ fontSize:12, color:'#166534', background:'#f0fdf4', padding:'4px 8px', borderRadius:6, textAlign:'center' }}>
                  Vinnare: <strong>{playoffResults[m.winRef]}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  ))}
</div>
```

);
}