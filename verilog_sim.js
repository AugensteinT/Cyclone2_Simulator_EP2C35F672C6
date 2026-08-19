// board_inputs and registers

let board_inputs = {
  SW: Array(18).fill(0)   // SW[17:0]
};
let board_outputs = {
  LEDR: Array(18).fill(0),  // LEDR[17:0]
  LEDG: Array(9).fill(0),   // LEDG[8:0]
  HEX0: Array(7).fill(0),
  HEX1: Array(7).fill(0),
  HEX2: Array(7).fill(0),
  HEX3: Array(7).fill(0),
  HEX4: Array(7).fill(0),
  HEX5: Array(7).fill(0),
  HEX6: Array(7).fill(0),
  HEX7: Array(7).fill(0),
};

let bit_order = {
  SW: {"msb": 17, "lsb": 0},
  LEDR: {"msb": 17, "lsb": 0}, 
  LEDG: {"msb": 8, "lsb": 0},
  HEX0: {"msb": 6, "lsb": 0},
  HEX1: {"msb": 6, "lsb": 0},
  HEX2: {"msb": 6, "lsb": 0},
  HEX3: {"msb": 6, "lsb": 0},
  HEX4: {"msb": 6, "lsb": 0},
  HEX5: {"msb": 6, "lsb": 0},
  HEX6: {"msb": 6, "lsb": 0},
  HEX7: {"msb": 6, "lsb": 0},
};

let verilogCode = '';

const textarea = document.getElementById("verilogCode");

textarea.addEventListener("input", () => {

    const code = document.getElementById("verilogCode").value;
    const btn = document.getElementById("compileBtn");

    if (verilogCode !== code) {
        btn.textContent = "Compile"; // Change text to indicate compilation
        btn.classList.remove("compiled");
    }
    else {
        btn.textContent = "Compiled"; // Change text to indicate compilation
        btn.classList.add("compiled");
    }
});

// Compile button
document.getElementById("compileBtn").addEventListener("click", () => {
    compileCode();
});

for (let i = 0; i <= 17; i++) {
    const sw = document.getElementById(`SW${i}`);
    if (sw) {
        sw.addEventListener('click', () => {
            // Toggle switch state: 0 = down/off, 1 = up/on
            board_inputs.SW[i] = board_inputs.SW[i] ? 0 : 1;
            
            // Update visual
            if (board_inputs.SW[i]) sw.classList.add('on');
            else sw.classList.remove('on');

            runSimulation();
        });
    }
}

compileCode();

// Compile function
function compileCode() {
    const code = document.getElementById("verilogCode").value;
    verilogCode = code;
    const btn = document.getElementById("compileBtn");
    btn.textContent = "Compiling";
    
    // TODO: Phraser

    btn.textContent = "Compiled"; 
    btn.classList.add("compiled");

    runSimulation();
}

function preprocessVerilog(code) {
    // Remove multi-line comments first
    code = code.replace(/\/\*[\s\S]*?\*\//g, "");
    // Remove single-line comments
    code = code.replace(/\/\/.*$/gm, "");

    // Remove all whitespace (spaces, tabs, newlines)
    code = code.replace(/\s+/g, "");

    // Insert newlines after ";" and "endmodule"
    code = code.replace(/;/g, ";\n");                      // after semicolon
    code = code.replace(/\bendmodule\b/g, "endmodule\n");  // after endmodule
    code = code.replace("\n", ""); 

    // Split into lines and remove empty lines
    return code.split("\n").filter(line => line.length > 0);
}

function extractModules(code) {

    const lines = preprocessVerilog(code);

    const modules = [];
    let currentModule = null;
    let insideModule = false;

    for (let line of lines) {
        line = line.trim(); // clean leading/trailing whitespace

        // Detect module start
        if (line.startsWith("module")) {
            insideModule = true;
            currentModule = line; // start a new module
            continue;
        }

        // If inside a module, collect lines
        if (insideModule) {
            currentModule += line;

            // Detect module end
            if (line.startsWith("endmodule")) {
                insideModule = false;
                modules.push(currentModule);
                currentModule = null;
            }
        }
    }

    return modules; // each element is an array of lines for a module
}

function updateBitsOrder(verilogStr) {
    // Initialize bit_order if not already
    if (typeof bit_order === "undefined") bit_order = {};

    // Regex to match input/output with optional wire/reg, optional [msb:lsb], and variable names
    const regex = /(input|output)\s*(wire|reg)?\s*(\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([\w\s,]+)/g;

    let match;
    while ((match = regex.exec(verilogStr)) !== null) {
        const msb = match[4] ? parseInt(match[4]) : 0;
        const lsb = match[5] ? parseInt(match[5]) : 0;

        // Split variable names by comma and remove whitespace
        const vars = match[6].split(',').map(v => v.trim());

        // Add each variable to the bit_order object
        vars.forEach(v => {
            if(v) bit_order[v] = { msb, lsb };
        });
    }
}

async function runSimulation() {
    if (!verilogCode) return;

    topLevelModule = extractModules(verilogCode)[0]; // get the first module

    updateBitsOrder(topLevelModule);
    
    const packet = {
        code: verilogCode,
        inputs: {
            SW: bitsToInt(board_inputs.SW, bit_order.SW.msb, bit_order.SW.lsb), // reverse to match SW[0] = LSB
        }
    };

    console.log("Running simulation with inputs:", packet.inputs);

    try {
        const response = await fetch("http://localhost:8000/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(packet)
        });

        const result = await response.json();

        if (result.error_messages) {
            const errorDisplay = document.getElementById("errorDisplay");
            if (errorDisplay) {
                errorDisplay.value = result.error_messages;  // use .value for textarea
                errorDisplay.style.display = "block";         // show textarea
            }
            return; // Exit if there are errors
        } else {
            const errorDisplay = document.getElementById("errorDisplay");
            if (errorDisplay) {
                errorDisplay.value = ""; // clear any previous errors
                errorDisplay.style.display = "none"; // hide textarea
            }
        }

        console.log("Simulation result:", result.outputs);

        // Map outputs back to bit arrays
        board_outputs.LEDR = intToBits(result.outputs.LEDR || 0, 18, bit_order.LEDR.msb, bit_order.LEDR.lsb);
        board_outputs.LEDG = intToBits(result.outputs.LEDG || 0, 9, bit_order.LEDG.msb, bit_order.LEDG.lsb);
        board_outputs.HEX0 = intToBits(result.outputs.HEX0 || 0, 7, bit_order.HEX0.msb, bit_order.HEX0.lsb);
        board_outputs.HEX1 = intToBits(result.outputs.HEX1 || 0, 7, bit_order.HEX1.msb, bit_order.HEX1.lsb);
        board_outputs.HEX2 = intToBits(result.outputs.HEX2 || 0, 7, bit_order.HEX2.msb, bit_order.HEX2.lsb);
        board_outputs.HEX3 = intToBits(result.outputs.HEX3 || 0, 7, bit_order.HEX3.msb, bit_order.HEX3.lsb);
        board_outputs.HEX4 = intToBits(result.outputs.HEX4 || 0, 7, bit_order.HEX4.msb, bit_order.HEX4.lsb);
        board_outputs.HEX5 = intToBits(result.outputs.HEX5 || 0, 7, bit_order.HEX5.msb, bit_order.HEX5.lsb);
        board_outputs.HEX6 = intToBits(result.outputs.HEX6 || 0, 7, bit_order.HEX6.msb, bit_order.HEX6.lsb);
        board_outputs.HEX7 = intToBits(result.outputs.HEX7 || 0, 7, bit_order.HEX7.msb, bit_order.HEX7.lsb);

        updateOutputs(); // refresh your UI
    } catch (err) {
        console.error("Simulation request failed:", err);
    }
}

function bitsToInt(bitsArray, msb, lsb) {
    let tempBitsArray = [];
    let sliceArray = [];
    if (msb >= lsb) {
        tempBitsArray = bitsArray.slice(lsb, msb + 1).reverse(); // reverse to match SW[0] = LSB
        sliceArray = tempBitsArray.slice(); 
    } else {
        tempBitsArray = bitsArray.slice(); // no reverse if msb < lsb
        sliceArray = tempBitsArray.slice(msb, lsb + 1);
    }
    
    return parseInt(sliceArray.join(''), 2);
}

function intToBits(value, length, msb, lsb) {
    
    let bits = [];
    for (let i = 0; i <= length - 1; i++) {
        bits[i] = (value >> i) & 1;
    }

    if (msb >= lsb) {
        if (lsb !== 0) {
            bits = Array(lsb).fill(0).concat(bits); // fill leading bits with zeros
        }
        bits = bits.slice(lsb, msb + 1); // reverse to match SW[0] = LSB
        if (lsb !== 0) {
            bits = Array(lsb).fill(0).concat(bits); // fill leading bits with zeros
        }
    }
    else {
        if (msb !== 0) {
            bits = Array(msb).fill(0).concat(bits); // fill leading bits with zeros
        }
        bits = bits.slice(msb, lsb + 1).reverse();
        if (msb !== 0) {
            bits = Array(msb).fill(0).concat(bits); // fill leading bits with zeros
        }
    }

    return bits; //
}

function updateOutputs() {

    for (let h = 7; h >= 0; h--) {
        const hexId = `HEX${h}`;
        const hexElem = document.getElementById(hexId);

        if (!hexElem) continue; // skip if element not found

        // loop through 7 segments SEG0–SEG6
        for (let s = 0; s <= 6; s++) {
        const seg = hexElem.querySelector(`#SEG${s}`);
            if (seg) {
                if (board_outputs[hexId][s] === 1) {
                    seg.classList.remove("on");
                } else {
                    seg.classList.add("on");
                }
                
            }
        }
    }

    // loop through 8 green LEDs LEDG8–LEDG0
    for (let s = 0; s <= 8; s++) {
        const seg = document.getElementById(`LEDG${s}`); // NO '#'
        if (seg) {
            if (board_outputs.LEDG[s] === 1) {
                seg.classList.add("on");
            } else {
                seg.classList.remove("on");
            }
        }
    }

    for (let i = 0; i <= 17; i++) {
        const led = document.getElementById(`LEDR${i}`);
        if (led) {
            if (board_outputs.LEDR[i] === 1) {
                led.classList.add("on");
            } else {
                led.classList.remove("on");
            }
        }
    }


}

const verilogCode2 = document.getElementById("verilogCode");
const lineNumbers = document.getElementById("lineNumbers");

function updateLineNumbers() {
    const lineCount = verilogCode2.value.split("\n").length;

    let numbers = "";

    for (let i = 1; i <= lineCount; i++) {
        numbers += i;

        if (i < lineCount) {
            numbers += "\n";
        }
    }

    lineNumbers.textContent = numbers;
}

// Update line numbers while typing
verilogCode2.addEventListener("input", updateLineNumbers);

// Keep line numbers vertically aligned with the code
verilogCode2.addEventListener("scroll", () => {
    lineNumbers.scrollTop = verilogCode2.scrollTop;
});

// Initial line numbers
updateLineNumbers();