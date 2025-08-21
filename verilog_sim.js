// Inputs and registers

let inputs = {
  SW: Array(18).fill(0)   // SW[17:0]
};
let outputs = {
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
            inputs.SW[i] = inputs.SW[i] ? 0 : 1;
            
            // Update visual
            if (inputs.SW[i]) sw.classList.add('on');
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

function runSimulation() {


    updateOutputs();
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
                if (outputs[hexId][s] === 1) {
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
            if (outputs.LEDG[s] === 1) {
                seg.classList.add("on");
            } else {
                seg.classList.remove("on");
            }
        }
    }

    for (let i = 0; i <= 17; i++) {
        const led = document.getElementById(`LEDR${i}`);
        if (led) {
            if (outputs.LEDR[i] === 1) {
                led.classList.add("on");
            } else {
                led.classList.remove("on");
            }
        }
    }


}