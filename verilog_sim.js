// board_inputs and registers

let board_inputs = {
  SW: Array(18).fill(0)   // SW[17:0]
};
let board_outputs = {
  LEDR: Array(18).fill(0),  // LEDR[17:0]
  LEDG: Array(8).fill(0),   // LEDG[7:0]
  HEX0: Array(7).fill(0),
  HEX1: Array(7).fill(0),
  HEX2: Array(7).fill(0),
  HEX3: Array(7).fill(0),
  HEX4: Array(7).fill(0),
  HEX5: Array(7).fill(0),
  HEX6: Array(7).fill(0),
  HEX7: Array(7).fill(0),
};

let verilogCode = '';

updateOutputs();

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

// Compile function
function compileCode() {
    console.log("Compiling Verilog Logic...");
    const code = document.getElementById("verilogCode").value;
    verilogCode = code;
    const btn = document.getElementById("compileBtn");
    btn.textContent = "Compiling";
    
    // TODO: Phraser

    btn.textContent = "Compiled"; 
    btn.classList.add("compiled");
    console.log("Compilation complete!");

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

    // Split into lines and remove empty lines
    return code.split("\n").filter(line => line.length > 0);
}

function extractModules(lines) {
    const modules = [];
    let currentModule = null;
    let insideModule = false;

    for (let line of lines) {
        line = line.trim(); // clean leading/trailing whitespace

        // Detect module start
        if (line.startsWith("module")) {
            insideModule = true;
            currentModule = [line]; // start a new module
            continue;
        }

        // If inside a module, collect lines
        if (insideModule) {
            currentModule.push(line);

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

async function runSimulation() {
    if (!verilogCode) return;


    const packet = {
        code: verilogCode,
        inputs: {
            SW: bitsToInt(board_inputs.SW), // reverse to match SW[0] = LSB
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
        console.log("Simulation result:", result);

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

        // Map outputs back to bit arrays
        board_outputs.LEDR = intToBits(result.outputs.LEDR || 0, 18);
        board_outputs.LEDG = intToBits(result.outputs.LEDG || 0, 8);
        board_outputs.HEX0 = intToBits(result.outputs.HEX0 || 0, 7);
        board_outputs.HEX1 = intToBits(result.outputs.HEX1 || 0, 7);
        board_outputs.HEX2 = intToBits(result.outputs.HEX2 || 0, 7);
        board_outputs.HEX3 = intToBits(result.outputs.HEX3 || 0, 7);
        board_outputs.HEX4 = intToBits(result.outputs.HEX4 || 0, 7);
        board_outputs.HEX5 = intToBits(result.outputs.HEX5 || 0, 7);
        board_outputs.HEX6 = intToBits(result.outputs.HEX6 || 0, 7);
        board_outputs.HEX7 = intToBits(result.outputs.HEX7 || 0, 7);

        updateOutputs(); // refresh your UI
    } catch (err) {
        console.error("Simulation request failed:", err);
    }
}

function bitsToInt(bitsArray) {
    tempBitsArray = bitsArray.slice().reverse(); // reverse to match SW[0] = LSB
  return parseInt(tempBitsArray.join(''), 2);
}

function intToBits(value, length) {
  let bits = [];
  for (let i = 0; i <= length - 1; i++) {
    bits[i] = (value >> i) & 1;
  }

  let tempBitsArray = bits.slice(); // reverse to match SW[0] = LSB
  return tempBitsArray; //
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

    // loop through 8 green LEDs LEDG7–LEDG0
    for (let s = 0; s <= 7; s++) {
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