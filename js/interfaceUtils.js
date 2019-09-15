"use strict";

/* Set up global object for status variables */
let PithosData = {
  numGivens: 0,
  proof: null,
  selectedLinesSet: new Set([]),
  lineNumToSelector: {},
  selectedRuleData: null,
  selectedButton: null,
  freeSelection: true,
}

/*
 * Parse all formulas and report the results of the parsing
 * Returns true on success, false on failure
 */
function parseAll() {
  let signature = {
    constants: [],
    relationArities: {},
    functionArities: {}
  };
  let errors = false;
  let parsingResults = {
    signature: signature,
    formulas: []
  }

  /* Parse all givens */
  for (let i = 0; i <= PithosData.numGivens; i++) {
    /* Backup signature in case of error in parsing */
    let signatureCopy = $.extend(true, {}, signature);
    let parsedFormula;
    let inputElement;
    let outputElement;
    if (i < PithosData.numGivens) {
      /* Process given formula */
      inputElement = $("#givenInput" + i);
      outputElement = $("#givenParsed" + i);
    } else {
      /* Process goal formula */
      inputElement = $("#goalInput");
      outputElement = $("#goalParsed");
    }
    try {
      parsedFormula = parseFormula(inputElement[0].value, signature);
      parsingResults.formulas.push(parsedFormula);
    } catch (error) {
      if (error instanceof FormulaParsingError) {
        /* Show result and log error */
        errors = true;
        outputElement.text(error.message);
        outputElement
            .removeClass("alert-dark alert-success")
            .addClass("alert-danger");
        /* Restore original signature */
        signature = signatureCopy;
        continue;
      } else {
        throw error;
      }
    }
    /* Show result */
    outputElement.text(parsedFormula.stringRep);
    outputElement
        .removeClass("alert-dark alert-danger")
        .addClass("alert-success");
  }

  /* Disable or enable Start proof button depending on errors */
  if (errors) {
    $("#startProof").attr("disabled", true);
    return null;
  }
  $("#startProof").attr("disabled", false);
  return parsingResults;
}

/*
 * Shows modal alert
 */
function showModal(title, modalBody, hint, customId, customButtons) {
  let hintHTML = "";
  if (hint !== undefined) {
    hintHTML =
      `<hr>
       <h5>Hint</h5>
       ${hint}`;
  }
  let customIdHTML = "";
  if (customId !== undefined) {
    customIdHTML = ` id="${customId}"`;
  }
  let defaultButton
      = `<button${customIdHTML} type="button" class="btn btn-outline-primary" data-dismiss="modal">OK</button>`;
  let buttons = defaultButton;
  if (customButtons !== undefined) {
    buttons = customButtons;
  }
  let template =
      `<div id="dynamicModal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="dynamicModalLabel" aria-hidden="true">
  			 <div class="modal-dialog modal-dialog-centered" role="document">
  				 <div class="modal-content">
  					 <div class="modal-header">
  						 <h5 class="modal-title" id="dynamicModalLabel">${title}</h5>
  						 <button type="button" class="close" data-dismiss="modal" aria-label="Close">
  							 <span aria-hidden="true">&times;</span>
  						 </button>
  					 </div>
  					 <div class="modal-body">
  						 ${modalBody}${hintHTML}
  					 </div>
  					 <div class="modal-footer">
  						 ${buttons}
  					 </div>
  				 </div>
  			 </div>
  		 </div>`
  $("#dynamicModalArea").html(template);
  $("#dynamicModal").modal("show");
}

/*
 * Cancells selection of all lines
 */
function resetSelectedLines() {
  PithosData.selectedLinesSet
      .forEach(elem =>
          PithosData.lineNumToSelector[elem].removeClass("text-primary"));
  PithosData.selectedLinesSet = new Set([]);
}

/*
 * Applies previously specified rule to the proof, updates view and cleans up
   afterwards
 */
function updateProof() {
  try {
    PithosData.selectedRuleData.handler();
  } catch (error) {
    if (error instanceof ProofProcessingError) {
      handleProofProcessingError(error);
    } else {
      throw error;
    }
  }
  updateLines(PithosData.proof);
  resetSelectedLines();
  $("#proofContainer").html(proofToHTML(PithosData.proof));
  PithosData.freeSelection = true;
  $(PithosData.selectedButton)
      .removeClass("btn-primary")
      .addClass("btn-secondary");
}

/*
 * Completes update of the proof in case of rules requiring additional input
 */
function completeProofUpdate() {
  updateLines(PithosData.proof);
  $("#proofContainer").html(proofToHTML(PithosData.proof));
}

/*
 * Shows informative error message on error
 */
function handleProofProcessingError(error) {
  $(".modal-backdrop").remove();
  showModal("Error", `<p>An error occured during application of the rule `
      + `${PithosData.selectedRuleData.name}:</p> <p>${error.message}</p>`,
      PithosData.selectedRuleData.hint);
}
