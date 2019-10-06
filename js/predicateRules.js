"use strict";

/*
 * Function handling existential introduction
 */
function introduceExistential() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let justificationLines = retrievedLines.justificationLines;
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  if (justificationLines.length + 1 < pithosData.selectedRuleData.numLines) {
    introduceExistentialBackwards();
    return;
  }
  let justificationFormula = justificationLines[0].formula;
  if (targetLine instanceof EmptyProofLine) {
    /* Target line is an empty line - allow user to specify resulting formula */
    let requestText = "Please enter the formula that you would like to "
        + "derive using existential introduction rule from "
        + `${justificationFormula.stringRep}:`;
    requestFormulaInput(requestText, "introduceExistentialComplete");
  } else {
    /* Target line is a goal line - choose the goal formula automatically */
    let targetFormula = targetLine.formula;
    if (targetFormula.type !== formulaTypes.EXISTENTIAL) {
      throw new ProofProcessingError("The selected formula is not an "
          + "existential.");
    }
    if (!verifyExistentialIntroduction(justificationFormula, targetFormula)) {
      throw new ProofProcessingError("The selected target formula cannot be "
          + "derived from the selected justification formula using existential "
          + "introduction. Please check that only closed terms have been "
          + "replaced by quantified variables and that terms replaced by "
          + "the same variable are identical.")
    }
    targetLine.justification
        = new Justification(justTypes.EXIS_INTRO, justificationLines);
    if (targetLine.prev instanceof EmptyProofLine) {
      targetLine.prev.delete();
    }
  }

  /*
   * Catch user action to complete the rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#introduceExistentialComplete");
  $("#dynamicModalArea").on("click", "#introduceExistentialComplete",
      function() {
    let skolemConstants = getSkolemConstants(targetLine);
    let targetFormula = parseFormula($("#additionalFormulaInput")[0].value,
        pithosData.proof.signature, skolemConstants);
    if (targetFormula.type !== formulaTypes.EXISTENTIAL) {
      let error = new ProofProcessingError("The entered formula is not an "
          + "existential.");
      handleProofProcessingError(error);
      return;
    }
    if (!verifyExistentialIntroduction(justificationFormula, targetFormula)) {
      let error = new ProofProcessingError("The selected target formula cannot "
          + "be derived from the selected justification formula using "
          + "existential introduction. Please check that only closed terms "
          + "have been replaced by quantified variables and that terms "
          + "replaced by the same variable are identical.")
      handleProofProcessingError(error);
      return;
    }
    let justification
        = new Justification(justTypes.EXIS_INTRO, justificationLines);
    let newLine = new JustifiedProofLine(targetFormula, justification);
    targetLine.prepend(newLine);
    completeProofUpdate();
  });

  /*
   * Function checking existential introduction application
   */
  function verifyExistentialIntroduction(justificationFormula, targetFormula) {
    /* Determine the difference in the number of existential quantifiers */
    let justificationExistentialCount = 0;
    let currFormula = justificationFormula;
    while (currFormula.type === formulaTypes.EXISTENTIAL) {
      justificationExistentialCount++;
      currFormula = currFormula.predicate;
    }
    let targetExistentialCount = 0;
    currFormula = targetFormula;
    while (currFormula.type === formulaTypes.EXISTENTIAL) {
      targetExistentialCount++;
      currFormula = currFormula.predicate;
    }
    if (targetExistentialCount <= justificationExistentialCount) {
      /* Fail verification if there are no additional existential quantifiers
         in the target formula */
      return false;
    }
    /* Attempt to match formulas to verify rule application */
    let addedExistentialCount
        = targetExistentialCount - justificationExistentialCount;
    let existentialVariablesSet = new Set([]);
    currFormula = targetFormula;
    for (let i = 0; i < addedExistentialCount; i++) {
      existentialVariablesSet.add(currFormula.variableString);
      currFormula = currFormula.predicate;
    }
    return matchFormulasVariablesReplace(justificationFormula, currFormula,
        existentialVariablesSet, {});
  }

  /*
   * Introduces existential through a backward rule application
   */
  function introduceExistentialBackwards() {
    if (targetLine instanceof EmptyProofLine) {
      throw new ProofProcessingError("The backward rule application cannot "
          + "be performed on an empty line.");
    }
    if (targetLine.formula.type !== formulaTypes.EXISTENTIAL) {
      throw new ProofProcessingError("The selected goal formula is not an "
          + "existential and hence cannot be derived by existential "
          + "inroduction.");
    }
    let targetFormula = targetLine.formula;
    requestFormulaInput("Please enter the formula that should pose as a "
            + `justification for ${targetFormula.stringRep}:`,
        "introduceExistentialBackwardsComplete");

    /*
     * Catch user action for the backward rule application completion
     */
    /* Unbind possible previously bound event */
    $("#dynamicModalArea").off("click",
        "#introduceExistentialBackwardsComplete");
    $("#dynamicModalArea").on("click", "#introduceExistentialBackwardsComplete",
        function() {
      let skolemConstants = getSkolemConstants(targetLine);
      let newGoalFormula = parseFormula($("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      if (!verifyExistentialIntroduction(newGoalFormula, targetFormula)) {
        let error = new ProofProcessingError("The selected goal formula "
            + "cannot be derived from the entered justification formula "
            + "through the existential introduction rule.");
        handleProofProcessingError(error);
        return;
      }
      let newGoalLine = new JustifiedProofLine(newGoalFormula,
          new SpecialJustification(justTypes.GOAL));
      targetLine.prepend(newGoalLine);
      justificationLines = [newGoalLine];
      targetLine.justification = new Justification(justTypes.EXIS_INTRO,
          justificationLines);
      completeProofUpdate();
    });
  }
}

/*
 * Function handling existential elimination
 */
function eliminateExistential() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let justificationLines = retrievedLines.justificationLines;
  let targetLine = retrievedLines.targetLine;
  /* Declared for use by following code */
  let initialFormula;
  let newSkolemConstants = new Set([]);
  let justificationFormula;
  if (justificationLines.length + 1 < pithosData.selectedRuleData.numLines) {
    eliminateExistentialBackwards();
    return;
  }
  justificationFormula = justificationLines[0].formula;
  if (justificationFormula.type !== formulaTypes.EXISTENTIAL) {
    throw new ProofProcessingError("The selected justification formula is "
        + "not an existential.");
  }
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  requestNumEliminated();

  function requestNumEliminated() {
    /* Ask the user how many outer exists quantifiers should be eliminated */
    let modalBody =
         "<p>Please choose the number of outer quantifiers that should be "
         + `eliminated from the formula ${justificationFormula.stringRep}:</p>`;
    let existentialCount = 0;
    for (let currFormula = justificationFormula;
        currFormula.type === formulaTypes.EXISTENTIAL;
        currFormula = currFormula.predicate) {
      modalBody +=
          `<div class="custom-control custom-radio">
             <input type="radio" id="existentialRadio${existentialCount}" class="custom-control-input">
             <label class="custom-control-label" for="existentialRadio${existentialCount}">${existentialCount + 1}</label>
           </div>`
      existentialCount++;
    }
    if (existentialCount === 1) {
      eliminateExistentialContinue(existentialCount);
    } else {
      showModal("Input required", modalBody, undefined,
          "eliminateExistentialContinue");
    }

    /*
     * Catch user action to proceed with the rule application
     */
    /* Unbind possible previously bound events */
    $("#dynamicModalArea").off("click", "#eliminateExistentialContinue");
    $("#dynamicModalArea").on("click", "#eliminateExistentialContinue",
        function() {
      let numberEliminated = 0;
      for (let i = 0; i < existentialCount; i++) {
        if ($("#existentialRadio" + i).is(":checked")) {
          numberEliminated = i + 1;
          break;
        }
      }
      if (numberEliminated === 0) {
        numberEliminated = existentialCount;
      }
      eliminateExistentialContinue(numberEliminated);
    })
  }

  function eliminateExistentialContinue(numberEliminated) {
    let replacements = {};
    let currFormula = justificationFormula;
    for (let i = 0; i < numberEliminated;
        i++) {
      replacements[currFormula.variableString]
          = new Constant(`sk${pithosData.proof.signature.skolemNext}`);
      newSkolemConstants.add(`sk${pithosData.proof.signature.skolemNext}`);
      pithosData.proof.signature.skolemNext++;
      currFormula = currFormula.predicate;
    }
    initialFormula = replaceVariables(currFormula, replacements);
    if (targetLine instanceof EmptyProofLine) {
      /* Target line is an empty line - allow user to specify resulting
         formula */
      let requestText = "Please enter the formula that you would like to "
          + "introduce using existential elimination rule:";
      requestFormulaInput(requestText, "eliminateExistentialComplete");
    } else {
      /* Target line is a goal line - choose target formula automatically */
      let targetFormula = targetLine.formula;
      let initialLine = new JustifiedProofLine(initialFormula,
          new SpecialJustification(justTypes.ASS));
      let goalLine = new JustifiedProofLine(targetFormula,
          new SpecialJustification(justTypes.GOAL));
      let proofBox = new ProofBox(initialLine, goalLine, false,
          newSkolemConstants);
      targetLine.prepend(proofBox);
      let ruleJustificationLines
          = [justificationLines[0], initialLine, goalLine];
      targetLine.justification
          = new Justification(justTypes.EXIS_ELIM, ruleJustificationLines);
      completeProofUpdate();
    }
  }

  /*
   * Catch user action to complete the rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#eliminateExistentialComplete");
  $("#dynamicModalArea").on("click", "#eliminateExistentialComplete",
      function() {
    let skolemConstants = getSkolemConstants(targetLine);
    let targetFormula = parseFormula($("#additionalFormulaInput")[0].value,
        pithosData.proof.signature, skolemConstants);
    let initialLine = new JustifiedProofLine(initialFormula,
        new SpecialJustification(justTypes.ASS));
    let goalLine = new JustifiedProofLine(targetFormula,
        new SpecialJustification(justTypes.GOAL));
    let proofBox = new ProofBox(initialLine, goalLine, false,
        newSkolemConstants);
    let newEmptyLine = new EmptyProofLine();
    targetLine.append(newEmptyLine);
    newEmptyLine.prepend(proofBox);
    let ruleJustificationLines = [justificationLines[0], initialLine, goalLine];
    let justification
        = new Justification(justTypes.EXIS_ELIM, ruleJustificationLines);
    let newJustifiedLine = new JustifiedProofLine(targetFormula, justification);
    newEmptyLine.prepend(newJustifiedLine);
    completeProofUpdate();
  });

  /*
   * Eliminates existential through a backward rule application
   */
  function eliminateExistentialBackwards() {
    if (targetLine instanceof EmptyProofLine) {
      throw new ProofProcessingError("The backward rule application cannot "
          + "be performed on an empty line.");
    }
    let targetFormula = targetLine.formula;
    requestFormulaInput("Please enter the existential formula that should "
            + `pose as a justification for ${targetFormula.stringRep}:`,
        "eliminateExistentialBackwardsContinue");

    /*
     * Catch user action for the backward rule application completion
     */
    /* Unbind possible previously bound event */
    $("#dynamicModalArea").off("click",
        "#eliminateExistentialBackwardsContinue");
    $("#dynamicModalArea").on("click", "#eliminateExistentialBackwardsContinue",
        function() {
      let skolemConstants = getSkolemConstants(targetLine);
      justificationFormula = parseFormula($("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      if (justificationFormula.type !== formulaTypes.EXISTENTIAL) {
        let error = new ProofProcessingError("The entered justification "
            + "formula is not an existential.");
        handleProofProcessingError(error);
        return;
      }
      let newGoalLine = new JustifiedProofLine(justificationFormula,
          new SpecialJustification(justTypes.GOAL));
      justificationLines.push(newGoalLine);
      targetLine.prepend(newGoalLine);
      requestNumEliminated();
    });
  }
}

/*
 * Function handling universal introduction
 */
function introduceUniversal() {
  addUniversal(false);
}

/*
 * Function handling universal elimination
 */
function eliminateUniversal() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let justificationLines = retrievedLines.justificationLines;
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  if (justificationLines.length + 1 < pithosData.selectedRuleData.numLines) {
    eliminateUniversalBackwards();
    return;
  }
  let justificationFormula = justificationLines[0].formula;
  if (justificationFormula.type !== formulaTypes.UNIVERSAL) {
    throw new ProofProcessingError("The selected justification formula is "
        + "not a universal.");
  }
  /* Count the number of universal quantifiers in the justification formula
     and prepare modal allowing the user to choose the number of quantifiers
     to eliminate. */
  let modalBody = "<p>Please choose the number of outer quantifiers that "
       + "should be eliminated from the formula "
       + `${justificationFormula.stringRep}:</p>`;
  let universalCount = 0;
  for (let currFormula = justificationFormula;
      currFormula.type === formulaTypes.UNIVERSAL;
      currFormula = currFormula.predicate) {
    modalBody +=
        `<div class="custom-control custom-radio">
           <input type="radio" id="universalRadio${universalCount}" class="custom-control-input">
           <label class="custom-control-label" for="universalRadio${universalCount}">${universalCount + 1}</label>
         </div>`
    universalCount++;
  }
  /* Declared variables for use by following code */
  let numberEliminated;
  if (targetLine instanceof EmptyProofLine) {
    /* Target is an empty line - determine the number of outer qualifiers to
       eliminate. */
    if (universalCount === 1) {
      numberEliminated = 1;
      eliminateUniversalContinue(universalCount);
    } else {
      showModal("Input required", modalBody, undefined,
          "eliminateUniversalContinue");
    }
  } else {
    /* Target line is a goal line - automatically determine the target formula
       and check the rule application. */
    let targetFormula = targetLine.formula;
    if (!verifyUniversalElimination(justificationFormula, targetFormula)) {
      throw new ProofProcessingError("The selected target formula cannot be "
          + "derived from the selected justification formula using universal "
          + "elimination. Please check that only variables have been replaced "
          + "by terms and that same variables have not been replaced by "
          + "different terms.")
    }
    targetLine.justification
        = new Justification(justTypes.UNIV_ELIM, justificationLines);
    if (targetLine.prev instanceof EmptyProofLine) {
      targetLine.prev.delete();
    }
  }

  /*
   * Catch user action to proceed with the rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#eliminateUniversalContinue");
  $("#dynamicModalArea").on("click", "#eliminateUniversalContinue",
      function() {
    numberEliminated = 0;
    for (let i = 0; i < universalCount; i++) {
      if ($("#universalRadio" + i).is(":checked")) {
        numberEliminated = i + 1;
        break;
      }
    }
    if (numberEliminated === 0) {
      numberEliminated = universalCount;
    }
    eliminateUniversalContinue(numberEliminated);
  });

  function eliminateUniversalContinue(numberEliminated) {
    /* Determine the terms that the quantified variables should be replaced
       for */
    let modalBody = "<p>Please enter the terms that should replace the "
         + "universally quantified variables in the formula "
         + `${justificationFormula.stringRep}:</p>`;
    let currFormula = justificationFormula;
    for (let i = 0; i < numberEliminated; i++) {
      modalBody +=
          `<label for="additionalTermInput${i}">Variable ${currFormula.variableString}</label>
           <input id="additionalTermInput${i}" class="additional-term-input form-control mb-2" type="text" placeholder="Please type your term here." value="" autocomplete="off">
           <div id="additionalTermParsed${i}" class="alert alert-dark" role="alert" style="word-wrap: break-word; ">
             The result of the parsing will appear here.
           </div>`
      currFormula = currFormula.predicate;
    }
    showModal("Input required", modalBody, undefined,
        "eliminateUniversalComplete", undefined, true);
  }

  /*
   * Catch user action to complete rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#eliminateUniversalComplete");
  $("#dynamicModalArea").on("click", "#eliminateUniversalComplete",
      function() {
    let replacements = {};
    let currFormula = justificationFormula;
    let skolemConstants = getSkolemConstants(targetLine);
    for (let i = 0; i < numberEliminated; i++) {
      let variable = currFormula.variableString;
      let term = parseSeparateTerm($("#additionalTermInput" + i)[0].value,
          pithosData.proof.signature, skolemConstants);
      replacements[variable] = term;
      currFormula = currFormula.predicate;
    }
    let newFormula = replaceVariables(currFormula, replacements);
    let justification
        = new Justification(justTypes.UNIV_ELIM, justificationLines);
    let newLine = new JustifiedProofLine(newFormula, justification);
    targetLine.prepend(newLine);
    completeProofUpdate();
  });

  /*
   * Function checking universal elimination application
   */
  function verifyUniversalElimination(justificationFormula, targetFormula) {
    /* Determine the difference in the number of existential quantifiers */
    let justificationUniversalCount = 0;
    let currFormula = justificationFormula;
    while (currFormula.type === formulaTypes.UNIVERSAL) {
      justificationUniversalCount++;
      currFormula = currFormula.predicate;
    }
    let targetUniversalCount = 0;
    currFormula = targetFormula;
    while (currFormula.type === formulaTypes.UNIVERSAL) {
      targetUniversalCount++;
      currFormula = currFormula.predicate;
    }
    if (targetUniversalCount >= justificationUniversalCount) {
      /* Fail verification if there are no additional existential quantifiers
         in the justification formula */
      return false;
    }
    /* Attempt to match formulas to verify rule application */
    let eliminatedUniversalCount
        = justificationUniversalCount - targetUniversalCount;
    let universalVariablesSet = new Set([]);
    currFormula = justificationFormula;
    for (let i = 0; i < eliminatedUniversalCount; i++) {
      universalVariablesSet.add(currFormula.variableString);
      currFormula = currFormula.predicate;
    }
    return matchFormulasVariablesReplace(targetFormula, currFormula,
        universalVariablesSet, {});
  }

  /*
   * Eliminates universal through a backward rule application
   */
  function eliminateUniversalBackwards() {
    if (targetLine instanceof EmptyProofLine) {
      throw new ProofProcessingError("The backward rule application cannot "
          + "be performed on an empty line.");
    }
    let targetFormula = targetLine.formula;
    requestFormulaInput("Please enter the universal formula that should "
            + `pose as a justification for ${targetFormula.stringRep}:`,
        "eliminateUniversalBackwardsComplete");

    /*
     * Catch user action for the backward rule application completion
     */
    /* Unbind possible previously bound event */
    $("#dynamicModalArea").off("click",
        "#eliminateUniversalBackwardsComplete");
    $("#dynamicModalArea").on("click", "#eliminateUniversalBackwardsComplete",
        function() {
      let skolemConstants = getSkolemConstants(targetLine);
      let newGoalFormula = parseFormula($("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      if (newGoalFormula.type !== formulaTypes.UNIVERSAL) {
        let error = new ProofProcessingError("The entered justification "
            + "formula is not a universal.");
        handleProofProcessingError(error);
        return;
      }
      if (!verifyUniversalElimination(newGoalFormula, targetFormula)) {
        let error = new ProofProcessingError("The entered universal "
            + "formula cannot be used as a justification for the originally "
            + "selected goal formula.")
        handleProofProcessingError(error);
        return;
      }
      let newGoalLine = new JustifiedProofLine(newGoalFormula,
          new SpecialJustification(justTypes.GOAL));
      justificationLines.push(newGoalLine);
      targetLine.prepend(newGoalLine);
      targetLine.justification = new Justification(justTypes.UNIV_ELIM,
          [newGoalLine]);
      completeProofUpdate();
    });
  }
}

/*
 * Function handling universal implication introduction
 */
function introduceUniversalImplication() {
  addUniversal(true);
}

/*
 * Function handling universal implication elimination
 */
function eliminateUniversalImplication() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let justificationLines = retrievedLines.justificationLines;
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  if (justificationLines.length + 1 < pithosData.selectedRuleData.numLines) {
    eliminateUniversalImplicationBackwards();
    return;
  }
  /* Determine which formula serves as an antecedent and which as universal
     implication */
  let justFormula1 = justificationLines[0].formula;
  let justFormula2 = justificationLines[1].formula;
  let unpacked1 = unpackUniversal(justFormula1);
  let unpacked2 = unpackUniversal(justFormula2);
  let innerFormula1 = unpacked1.innerFormula;
  let innerFormula2 = unpacked2.innerFormula;
  let varSet1 = unpacked1.variablesSet;
  let varSet2 = unpacked2.variablesSet;
  let universalFormula;
  let unpackedUniversal;
  let antecedentFormula;
  let replacements;
  let replacements1 = {};
  let replacements2 = {};
  if (unpacked1.isUniversalImplication && unpacked2.isUniversalImplication) {
    if (matchFormulasVariablesReplace(justFormula1, innerFormula2.operand1,
        varSet2, replacements1)) {
      universalFormula = justFormula2;
      unpackedUniversal = unpacked2;
      antecedentFormula = justFormula1;
      replacements = replacements1;
    } else if (matchFormulasVariablesReplace(justFormula2,
        innerFormula1.operand1, varSet1, replacements2)) {
      universalFormula = justFormula1;
      unpackedUniversal = unpacked1;
      antecedentFormula = justFormula2;
      replacements = replacements2;
    } else {
      throw new ProofProcessingError("The selected lines cannot be used as "
          + "a justification to universal implication elimination.");
    }
  } else if (unpacked2.isUniversalImplication && matchFormulasVariablesReplace(
      justFormula1, innerFormula2.operand1, varSet2, replacements1)) {
    universalFormula = justFormula2;
    unpackedUniversal = unpacked2;
    antecedentFormula = justFormula1;
    replacements = replacements1;
  } else if (unpacked1.isUniversalImplication && matchFormulasVariablesReplace(
      justFormula2, innerFormula1.operand1, varSet1, replacements2)) {
    universalFormula = justFormula1;
    unpackedUniversal = unpacked1;
    antecedentFormula = justFormula2;
    replacements = replacements2;
  } else {
    throw new ProofProcessingError("The selected lines cannot be used as "
        + "a justification to universal implication elimination.");
  }
  /* Declare variable for use by following code */
  let underivableVarsSet = new Set([]);
  if (targetLine instanceof EmptyProofLine) {
    /* Target is an empty line - determine which variable replacements cannot
       be automatically derived */
    unpackedUniversal.variablesSet.forEach(function(variable) {
      if (!replacements.hasOwnProperty(variable)) {
        underivableVarsSet.add(variable);
      }
    });
    if (underivableVarsSet.size === 0) {
      /* Terms for all variables can be automatically derived */
      let newFormula = replaceVariables(
          unpackedUniversal.innerFormula.operand2, replacements);
      let justification
          = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines);
      let newLine = new JustifiedProofLine(newFormula, justification);
      targetLine.prepend(newLine);
    } else {
      requestReplacementTerms("eliminateUniversalImplicationComplete",
          unpackedUniversal.innerFormula.operand2, underivableVarsSet);
    }
  } else {
    /* Target is a goal line */
    let targetFormula = targetLine.formula;
    if (!matchFormulasVariablesReplace(targetFormula,
        unpackedUniversal.innerFormula.operand2,
        unpackedUniversal.variablesSet, replacements)) {
      throw new ProofProcessingError("The selected goal line cannot be derived "
          + "from the selected justification lines using universal implication "
          + "elimination.");
    }
    targetLine.justification
        = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines);
    if (targetLine.prev instanceof EmptyProofLine) {
      targetLine.prev.delete();
    }
  }

  function requestReplacementTerms(buttonId, formula, underivableVarsSet) {
    /* User needs to choose replacement terms for some of the variables */
    let modalBody = "<p>Some of the terms that should be used in place of "
         + "the universally quantified variables could not be automatically "
         + "derived. Please enter the terms that should replace the "
         + "following variables in the formula "
         + `${formula.stringRep}:</p>`;
    let i = 0;
    underivableVarsSet.forEach(function(variable) {
      modalBody +=
          `<label for="additionalTermInput${i}">Variable ${variable}</label>
           <input id="additionalTermInput${i}" class="additional-term-input form-control mb-2" type="text" placeholder="Please type your term here." value="" autocomplete="off">
           <div id="additionalTermParsed${i}" class="alert alert-dark" role="alert" style="word-wrap: break-word; ">
             The result of the parsing will appear here.
           </div>`;
      i++;
    });
    showModal("Input required", modalBody, undefined,
        buttonId, undefined, true);
  }

  /*
   * Catch user action to complete rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#eliminateUniversalImplicationComplete");
  $("#dynamicModalArea").on("click", "#eliminateUniversalImplicationComplete",
      function() {
    let additionalReplacements = {};
    let skolemConstants = getSkolemConstants(targetLine);
    let i = 0;
    underivableVarsSet.forEach(function(variable) {
      let term = parseSeparateTerm($("#additionalTermInput" + i)[0].value,
          pithosData.proof.signature, skolemConstants);
      additionalReplacements[variable] = term;
      i++;
    });
    let tmpFormula = replaceVariables(
        unpackedUniversal.innerFormula.operand2, replacements);
    let newFormula = replaceVariables(tmpFormula, additionalReplacements);
    let justification
        = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines);
    let newLine = new JustifiedProofLine(newFormula, justification);
    targetLine.prepend(newLine);
    completeProofUpdate();
  });

  /*
   * Performs analysis of the given formula and returns data necessary for
     further processing if the formula is a universal
   */
  function unpackUniversal(formula) {
    let formulaData = {
      isUniversalImplication: false,
      universalCount: 0,
      variablesSet: new Set([]),
      innerFormula: null
    };
    if (formula.type !== formulaTypes.UNIVERSAL) {
      return formulaData;
    }
    let currFormula;
    for (currFormula = formula; currFormula.type === formulaTypes.UNIVERSAL;
        currFormula = currFormula.predicate) {
      formulaData.variablesSet.add(currFormula.variableString);
      formulaData.universalCount++;
    }
    formulaData.innerFormula = currFormula;
    if (currFormula.type === formulaTypes.IMPLICATION) {
      formulaData.isUniversalImplication = true;
    }
    return formulaData;
  }

  /*
   * Eliminates universal implication through a backward rule application
   */
  function eliminateUniversalImplicationBackwards() {
    if (targetLine instanceof EmptyProofLine) {
      throw new ProofProcessingError("The backward rule application cannot "
          + "be performed on an empty line.");
    }
    let targetFormula = targetLine.formula;
    /* Declare variables for use by the following code */
    let universalImplication;
    let universalImplicationFirst;
    let replacements;
    let underivableVarsSet;
    let unpacked;
    if (justificationLines.length === 0) {
      /* No justification formulas have been selected - prompt user for
         the universal implication formula */
      let requestText = "Please enter the universal implication formula "
          + "that should pose as one of the justification formulas "
          + `for ${targetFormula.stringRep} and choose which formula `
          + "should be proven first:";
      let buttons =
          `<button id="eliminateUniversalImplicationBackwardsContinueUnivImp" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal">Prove universal implication first</button>
           <button id="eliminateUniversalImplicationBackwardsContinueAnt" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal">Prove antecedent first</button>`
      requestFormulaInput(requestText, undefined, buttons);
    } else {
      /* A justification forula has been selected - attempt to determine the
         type of the formula and possibly prompt for additional information */
      let justificationFormula = justificationLines[0].formula;
      unpacked = unpackUniversal(justificationFormula);
      let varSet = unpacked.variablesSet;
      let innerFormula = unpacked.innerFormula;
      replacements = {};
      if (unpacked.isUniversalImplication && matchFormulasVariablesReplace(
          targetFormula, innerFormula.operand2, varSet, replacements)) {
        /* The selected justification formula is a universal implication -
           attempt to automatically derive the new goal formula
           (corresponding to the inner antecedent) */
        underivableVarsSet = new Set([]);
        varSet.forEach(function(variable) {
          if (!replacements.hasOwnProperty(variable)) {
            underivableVarsSet.add(variable);
          }
        });
        if (underivableVarsSet.size === 0) {
          /* Terms for all variables can be automatically derived */
          let newGoalFormula = replaceVariables(
              innerFormula.operand1, replacements);
          let newGoalLine = new JustifiedProofLine(newGoalFormula,
              new SpecialJustification(justTypes.GOAL));
          targetLine.prepend(newGoalLine);
          justificationLines.push(newGoalLine);
          targetLine.justification
              = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines);
        } else {
          /* Terms for some of the variables could not be automatically derived
             - prompt user for additional replacements */
          requestReplacementTerms(
              "eliminateUniversalImplicationBackwardsComplete",
              innerFormula.operand1, underivableVarsSet);
        }
      } else {
        /* The selected justification formula is an antecedent for the
           universal implication - prompt the user for the universal
           implication formula */
       let requestText = "Please enter the universal implication formula "
           + "that should pose as one of the justification formulas "
           + `for ${targetFormula.stringRep}:`;
       requestFormulaInput(requestText,
           "eliminateUniversalImplicationBackwardsCompleteJustAnt");
      }
    }

    /*
     * Catch user action in order to complete the backward rule application
       when universal implication has been chosen as the justification formula
     */
    $("#dynamicModalArea").off("click",
        "#eliminateUniversalImplicationBackwardsCompleteJustAnt");
    $("#dynamicModalArea").on("click",
        "#eliminateUniversalImplicationBackwardsCompleteJustAnt", function() {
      eliminateUniversalImplicationBackwardsContinue(null);
    });


    /*
     * Catch user action in order to proceed with the backward
       rule application
     */
    /* Unbind possible previously bound event */
    $("#dynamicModalArea").off("click",
        "#eliminateUniversalImplicationBackwardsContinueUnivImp");
    $("#dynamicModalArea").off("click",
        "#eliminateUniversalImplicationBackwardsContinueAnt");
    $("#dynamicModalArea").on("click",
        "#eliminateUniversalImplicationBackwardsContinueUnivImp", function() {
      eliminateUniversalImplicationBackwardsContinue(true);
    });
    $("#dynamicModalArea").on("click",
        "#eliminateUniversalImplicationBackwardsContinueAnt", function() {
      eliminateUniversalImplicationBackwardsContinue(false);
    });

    function eliminateUniversalImplicationBackwardsContinue(universalFirst) {
      universalImplicationFirst = universalFirst;
      let skolemConstants = getSkolemConstants(targetLine);
      universalImplication = parseFormula(
          $("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      unpacked = unpackUniversal(universalImplication);
      let varSet = unpacked.variablesSet;
      let innerFormula = unpacked.innerFormula;
      replacements = {};
      if (!unpacked.isUniversalImplication) {
        let error = new ProofProcessingError("The entered formula is not a "
            + "universal implication.")
        handleProofProcessingError(error);
        return;
      }
      if (!matchFormulasVariablesReplace(targetFormula, innerFormula.operand2,
          varSet, replacements)) {
        let error = new ProofProcessingError("The inner consequent of the "
            + "entered universal implication does not match the originally "
            + "selected target formula.")
        handleProofProcessingError(error);
        return;
      }
      if (justificationLines.length === 0) {
        /* Continuing from backwards rule application without any justification
           lines */
        underivableVarsSet = new Set([]);
        varSet.forEach(function(variable) {
          if (!replacements.hasOwnProperty(variable)) {
            underivableVarsSet.add(variable);
          }
        });
        if (underivableVarsSet.size === 0) {
          /* Terms for all variables can be automatically derived */
          let antecedent = replaceVariables(
              innerFormula.operand1, replacements);
          let newGoalLine1;
          let newGoalLine2;
          if (universalFirst) {
            newGoalLine1 = new JustifiedProofLine(universalImplication,
                new SpecialJustification(justTypes.GOAL));
            newGoalLine2 = new JustifiedProofLine(antecedent,
                new SpecialJustification(justTypes.GOAL));
          } else {
            newGoalLine1 = new JustifiedProofLine(antecedent,
                new SpecialJustification(justTypes.GOAL));
            newGoalLine2 = new JustifiedProofLine(universalImplication,
                new SpecialJustification(justTypes.GOAL));
          }
          targetLine.prepend(newGoalLine1);
          targetLine.prepend(new EmptyProofLine());
          targetLine.prepend(newGoalLine2);
          targetLine.justification
              = new Justification(justTypes.UNIV_IMP_ELIM,
                  [newGoalLine1, newGoalLine2]);
          completeProofUpdate();
        } else {
          /* Terms for some of the variables could not be automatically derived
             - prompt user for additional replacements */
          requestReplacementTerms(
              "eliminateUniversalImplicationBackwardsComplete",
              innerFormula.operand1, underivableVarsSet);
        }
      } else {
        /* Continuing from backwards rule application with the antecedent
           formula chosen as a justification */
        let justificationFormula = justificationLines[0].formula;
        if (!matchFormulasVariablesReplace(justificationFormula,
            innerFormula.operand1, varSet, replacements)) {
          let error = new ProofProcessingError("The inner antecedent of the "
              + "entered universal implication does not match the "
              + "selected justification formula.")
          handleProofProcessingError(error);
          return;
        }
        let newGoalLine = new JustifiedProofLine(universalImplication,
            new SpecialJustification(justTypes.GOAL));
        targetLine.prepend(newGoalLine);
        justificationLines.push(newGoalLine);
        targetLine.justification
            = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines)
        completeProofUpdate();
      }
    }

    /*
     * Catch user action in order to  complete the backward rule application
     */
    /* Unbind possible previously bound event */
    $("#dynamicModalArea").off("click",
        "#eliminateUniversalImplicationBackwardsComplete");
    $("#dynamicModalArea").on("click",
        "#eliminateUniversalImplicationBackwardsComplete", function() {
      let additionalReplacements = {};
      let skolemConstants = getSkolemConstants(targetLine);
      let i = 0;
      underivableVarsSet.forEach(function(variable) {
        let term = parseSeparateTerm($("#additionalTermInput" + i)[0].value,
            pithosData.proof.signature, skolemConstants);
        additionalReplacements[variable] = term;
        i++;
      });
      let tmpFormula = replaceVariables(
          unpacked.innerFormula.operand1, replacements);
      let antecedentFormula
          = replaceVariables(tmpFormula, additionalReplacements);
      if (justificationLines.length === 0) {
        /* Continuing from backwards rule application without any justification
           lines */
        let newGoalLine1;
        let newGoalLine2;
        if (universalImplicationFirst) {
          newGoalLine1 = new JustifiedProofLine(universalImplication,
              new SpecialJustification(justTypes.GOAL));
          newGoalLine2 = new JustifiedProofLine(antecedentFormula,
              new SpecialJustification(justTypes.GOAL));
        } else {
          newGoalLine1 = new JustifiedProofLine(antecedentFormula,
              new SpecialJustification(justTypes.GOAL));
          newGoalLine2 = new JustifiedProofLine(universalImplication,
              new SpecialJustification(justTypes.GOAL));
        }
        targetLine.prepend(newGoalLine1);
        targetLine.prepend(new EmptyProofLine());
        targetLine.prepend(newGoalLine2);
        targetLine.justification
            = new Justification(justTypes.UNIV_IMP_ELIM,
                [newGoalLine1, newGoalLine2]);
      } else {
        /* Continuing from backwards rule application with the universal
           implication formula chosen as a justification */
        let newGoalLine = new JustifiedProofLine(antecedentFormula,
            new SpecialJustification(justTypes.GOAL));
        targetLine.prepend(newGoalLine);
        justificationLines.push(newGoalLine);
        targetLine.justification
            = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines);
        let justification
            = new Justification(justTypes.UNIV_IMP_ELIM, justificationLines);
      }
      completeProofUpdate();
    });
  }
}

/*
 * Function handling equality substitution
 */
function applyEqualitySubstitution() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let justificationLines = retrievedLines.justificationLines;
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  if (justificationLines.length + 1 < pithosData.selectedRuleData.numLines) {
    applyEqualitySubstitutionBackwards();
    return;
  }
  let possibleReplacements = [];
  let suggestedTargetFormulas = [];
  let justFormula1 = justificationLines[0].formula;
  let justFormula2 = justificationLines[1].formula;
  if (justFormula1.type === formulaTypes.EQUALITY) {
    if (formulaContainsTerm(justFormula2, justFormula1.term1)) {
      if (!formulasDeepEqual(justFormula1.term1, justFormula1.term2)) {
        let suggestion = replaceTerm(justFormula2, justFormula1.term1,
            justFormula1.term2);
        suggestedTargetFormulas.push(suggestion);
      }
      possibleReplacements.push({
        formula: justFormula2,
        replaced: justFormula1.term1,
        replacement: justFormula1.term2
      });
    }
    if (formulaContainsTerm(justFormula2, justFormula1.term2)) {
      if (!formulasDeepEqual(justFormula1.term2, justFormula1.term1)) {
        let suggestion = replaceTerm(justFormula2, justFormula1.term2,
            justFormula1.term1);
        suggestedTargetFormulas.push(suggestion);
      }
      possibleReplacements.push({
        formula: justFormula2,
        replaced: justFormula1.term2,
        replacement: justFormula1.term1
      });
    }
  }
  if (justFormula2.type === formulaTypes.EQUALITY) {
    if (formulaContainsTerm(justFormula1, justFormula2.term1)) {
      if (!formulasDeepEqual(justFormula2.term1, justFormula2.term2)) {
        let suggestion = replaceTerm(justFormula1, justFormula2.term1,
            justFormula2.term2);
        suggestedTargetFormulas.push(suggestion);
      }
      possibleReplacements.push({
        formula: justFormula1,
        replaced: justFormula2.term1,
        replacement: justFormula2.term2
      });
    }
    if (formulaContainsTerm(justFormula1, justFormula2.term2)) {
      if (!formulasDeepEqual(justFormula2.term2, justFormula2.term1)) {
        let suggestion = replaceTerm(justFormula1, justFormula2.term2,
            justFormula2.term1);
        suggestedTargetFormulas.push(suggestion);
      }
      possibleReplacements.push({
        formula: justFormula1,
        replaced: justFormula2.term2,
        replacement: justFormula2.term1
      });
    }
  }
  /* Remove duplicate suggested formulas */
  _.uniqWith(suggestedTargetFormulas, formulasDeepEqual);
  if (possibleReplacements.length === 0) {
    throw new ProofProcessingError("The selected justification formulas cannot "
        + "be used for application of the equality substitution rule. "
        + "Please check that at least one of the selected formulas is an "
        + "equality and that at least one of the terms in the equality "
        + "appears in the second selected formula.");
  }
  if (targetLine instanceof EmptyProofLine) {
    let modalText =
         "Please enter the formula that you would like to introduce using "
         + "equality substitution or choose one of the suggested formulas.";
    let additionalContent = "";
    for (let i = 0; i < suggestedTargetFormulas.length; i++) {
      additionalContent +=
          `<button id="replacement${i}" type="button" class="btn btn-outline-primary btn-block" data-dismiss="modal">Introduce ${suggestedTargetFormulas[i].stringRep}</button>`
    }
    let button = `<button id="substituteEqualityFormula" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal" disabled>Use entered formula</button>`
    requestFormulaInput(modalText, undefined, button, additionalContent);
  } else {
    /* Target line is a goal line - automatically determine the target formula
       and check the rule application. */
    let targetFormula = targetLine.formula;
    let anyReplacementValid = possibleReplacements
        .some(r => matchFormulasTermsReplace(r.formula, targetFormula, r));
    if (!anyReplacementValid) {
     throw new ProofProcessingError("The selected target formula cannot be "
         + "derived from the selected justification formulas using equality "
         + "substitution. Please check that only one term has been substituted "
         + "in accordance with the selected equality formula.")
    }
    targetLine.justification
       = new Justification(justTypes.EQ_SUB, justificationLines);
    if (targetLine.prev instanceof EmptyProofLine) {
     targetLine.prev.delete();
    }
  }

  /*
   * Catch user action to complete rule application
   */
  for (let i = 0; i < suggestedTargetFormulas.length; i++) {
    $("#dynamicModalArea").off("click", "#replacement" + i);
    $("#dynamicModalArea").on("click", "#replacement" + i,
        function() {
      equalitySubstitutionComplete(true, i);
    });
  }
  $("#dynamicModalArea").off("click", "#substituteEqualityFormula");
  $("#dynamicModalArea").on("click", "#substituteEqualityFormula",
      function() {
    equalitySubstitutionComplete(false);
  });

  function equalitySubstitutionComplete(automatic, suggestionIndex) {
    let newFormula;
    if (automatic) {
      newFormula = suggestedTargetFormulas[suggestionIndex];
    } else {
      let skolemConstants = getSkolemConstants(targetLine);
      newFormula = parseFormula($("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      let anyReplacementValid = possibleReplacements
          .some(r => matchFormulasTermsReplace(r.formula, newFormula, r));
      if (!anyReplacementValid) {
        let error = new ProofProcessingError("The entered formula cannot be "
            + "derived from the selected justification formulas using equality "
            + "substitution. Please check that only one term has been "
            + "substituted in accordance with the selected equality formula.")
        handleProofProcessingError(error);
        return;
      }
    }
    let justification
        = new Justification(justTypes.EQ_SUB, justificationLines);
    let newLine = new JustifiedProofLine(newFormula, justification);
    targetLine.prepend(newLine);
    completeProofUpdate();
  }

  /*
   * Checks whether the target formula can be derived by equality substitution
     from the justification formula
   * Populates replacementObject with information about the match on success
     or respects the replacement specified by this object
   */
  function matchFormulasTermsReplace(justificationFormula, targetFormula,
      replacementObject) {
    if (targetFormula.type !== justificationFormula.type
        && !(targetFormula instanceof Term
            && justificationFormula instanceof Term)) {
      /* Types differ on non-term formulas - report failure */
      return false;
    }
    if (formulasDeepEqual(justificationFormula, targetFormula)) {
      /* Formulas are identical - report match success */
      return true;
    }
    if (justificationFormula instanceof Term) {
      if (justificationFormula.type === termTypes.CONSTANT
          || targetFormula.type === termTypes.CONSTANT) {
        /* Cannot recurse deeper - check replacement */
        return checkReplacement(justificationFormula, targetFormula,
            replacementObject);
      }
      if (targetFormula.type === termTypes.FUNCTION
          && justificationFormula.type === termTypes.FUNCTION) {
        if (targetFormula.name !== justificationFormula.name) {
          /* Function names do not match - check replacement */
          return checkReplacement(justificationFormula, targetFormula,
              replacementObject);
        }
        return _.zipWith(justificationFormula.terms, targetFormula.terms,
            (t1, t2) => matchFormulasTermsReplace(t1, t2, replacementObject))
            .reduce((b1, b2) => b1 && b2, true);
      }
    } else if (justificationFormula instanceof Quantifier) {
      if (justificationFormula.variableString
          !== targetFormula.variableString) {
        return false;
      }
      return matchFormulasTermsReplace(justificationFormula.predicate,
          targetFormula.predicate, replacementObject);
    } else if (justificationFormula.type === formulaTypes.RELATION) {
      if (justificationFormula.name !== targetFormula.name) {
        return false;
      }
      return _.zipWith(justificationFormula.terms, targetFormula.terms,
          (t1, t2) => matchFormulasTermsReplace(t1, t2, replacementObject))
          .reduce((b1, b2) => b1 && b2, true);
    } else if (justificationFormula instanceof Equality) {
      return matchFormulasTermsReplace(justificationFormula.term1,
              targetFormula.term1, replacementObject)
          && matchFormulasTermsReplace(justificationFormula.term2,
              targetFormula.term2, replacementObject);
    } else if (targetFormula.type === formulaTypes.NEGATION) {
      return matchFormulasTermsReplace(justificationFormula.operand,
          targetFormula.operand, replacementObject);
    } else if (justificationFormula instanceof BinaryConnective) {
      if (justificationFormula.isAssociative) {
        let operandsJustificationFormula = [];
        extractOperands(justificationFormula, operandsJustificationFormula,
            justificationFormula.type);
        let operandsTargetFormula = [];
        extractOperands(targetFormula, operandsTargetFormula,
            targetFormula.type);
        return _.zipWith(operandsJustificationFormula, operandsTargetFormula,
            (f1, f2) => matchFormulasTermsReplace(f1, f2, replacementObject))
            .reduce((b1, b2) => b1 && b2, true);
      } else {
        return matchFormulasTermsReplace(justificationFormula.operand1,
                targetFormula.operand1, replacementObject)
            && matchFormulasTermsReplace(justificationFormula.operand2,
                targetFormula.operand2, replacementObject);
      }
    } else {
      return false;
    }

    function checkReplacement(justificationFormula, targetFormula,
        replacementObject) {
      if (!isClosedTerm(justificationFormula)
          || !isClosedTerm(targetFormula)) {
        return false;
      }
      if (replacementObject.replaced instanceof Term
          && replacementObject.replaced instanceof Term) {
        return formulasDeepEqual(justificationFormula,
                replacementObject.replaced)
            && formulasDeepEqual(targetFormula, replacementObject.replacement);
      }
      replacementObject.replaced = justificationFormula;
      replacementObject.replacement = targetFormula;
      return true;
    }
  }

  /*
   * Applies equality substitution through a backward rule application
   */
  function applyEqualitySubstitutionBackwards() {
    if (targetLine instanceof EmptyProofLine) {
      throw new ProofProcessingError("The backward rule application cannot "
          + "be performed on an empty line.");
    }
    let targetFormula = targetLine.formula;
    /* Declare variables for use by the following code */
    let proveEqualityFirst;
    let suggestedJustificationFormulas = [];
    let possibleReplacements = [];
    let replacementObject;
    let equalityJustification;
    let otherJustification;
    let justificationFormula;
    if (justificationLines.length === 0) {
      /* No justification formulas have been selected - prompt user for
         the equality formula */
      let requestText = "Please enter the equality formula that should "
          + "be used as a justification for the equality substitution "
          + "and chose which of the justification formulas should "
          + "be proven first. The currently selected target formula is "
          + `${targetFormula.stringRep}.`;
      let buttons =
          `<button id="substituteEqualityBackwardsContinueEqFirst" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal">Prove equality first</button>
           <button id="substituteEqualityBackwardsContinueFormFirst" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal">Prove formula with replaced terms first</button>`
      requestFormulaInput(requestText, undefined, buttons);
    } else {
      /* A justification forula has been selected - attempt to determine the
         type of the formula and prompt for additional information */
      justificationFormula = justificationLines[0].formula;
      replacementObject = {};
      if (matchFormulasTermsReplace(justificationFormula, targetFormula,
          replacementObject)) {
        /* The selected justification formula is the formula with replaced
           terms. Prompt the user for the order of the operands in the
           justification equality */
        let requestText = "<p>Please choose the equality that should "
            + "pose as a new goal:</p>";
        let buttons =
            `<button id="substituteEqualityBackwardsCompleteJustForm1" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal">${replacementObject.replaced.stringRep} = ${replacementObject.replacement.stringRep}</button>
             <button id="substituteEqualityBackwardsCompleteJustForm2" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal">${replacementObject.replacement.stringRep} = ${replacementObject.replaced.stringRep}</button>`
        showModal("Input required", requestText, undefined, undefined, buttons);
      } else {
        if (justificationFormula.type !== formulaTypes.EQUALITY) {
          throw new ProofProcessingError("The selected justification formula "
              + "does not correspond with the target formula and hence the "
              + "equality substitution rule cannot be applied.")
        }
        /* An equality formula has been selected - determine the possible
           terms replacements and prompt the user to choose one */
        requestFormulaReplacedTerms(justificationFormula, "justificationJustEq",
            "substituteEqualityBackwardsCompleteJustEq");

      }
    }

    function requestFormulaReplacedTerms(equality, suggestedId,
        enteredId) {
      if (formulaContainsTerm(targetFormula, equality.term1)) {
        let suggestion = replaceTerm(targetFormula, equality.term1,
            equality.term2);
        if (!formulasDeepEqual(equality.term1, equality.term2)) {
          suggestedJustificationFormulas.push(suggestion);
        }
        possibleReplacements.push({
          justification: suggestion,
          replaced: equality.term2,
          replacement: equality.term1
        });
      }
      if (formulaContainsTerm(targetFormula, equality.term2)) {
        let suggestion = replaceTerm(targetFormula, equality.term2,
            equality.term1);
        if (!formulasDeepEqual(equality.term2, equality.term1)) {
          suggestedJustificationFormulas.push(suggestion);
        }
        possibleReplacements.push({
          justification: suggestion,
          replaced: equality.term1,
          replacement: equality.term2
        });
      }
      if (possibleReplacements.length === 0) {
        throw new ProofProcessingError("The selected justification formula "
            + "cannot be used for application of the equality substitution "
            + "rule. Please check that the selected equality contains "
            + "terms that occur in the target formula.");
      }
      let modalText =
           "Please enter the formula that should pose as a justification "
           + "for the equality substitution or choose one of the formulas "
           + "suggested. The selected target formula is "
           + `${targetFormula.stringRep}.`;
      let additionalContent = "";
      for (let i = 0; i < suggestedJustificationFormulas.length; i++) {
        additionalContent +=
            `<button id="${suggestedId}${i}" type="button" class="btn btn-outline-primary btn-block" data-dismiss="modal">${suggestedJustificationFormulas[i].stringRep}</button>`
      }
      let button = `<button id="${enteredId}" type="button" class="disable-parse-error btn btn-outline-primary" data-dismiss="modal" disabled>Use entered formula</button>`
      requestFormulaInput(modalText, undefined, button, additionalContent);
    }

    /*
     * Catch user action to continue with the backwards equality substitution
       if no justification formula has been selected
     */
    $("#dynamicModalArea").off("click",
        "#substituteEqualityBackwardsContinueEqFirst");
    $("#dynamicModalArea").on("click",
        "#substituteEqualityBackwardsContinueEqFirst", function() {
      applyEqualitySubstitutionBackwardsContinue(true);
    });
    $("#dynamicModalArea").off("click",
        "#substituteEqualityBackwardsContinueFormFirst");
    $("#dynamicModalArea").on("click",
        "#substituteEqualityBackwardsContinueFormFirst", function() {
      applyEqualitySubstitutionBackwardsContinue(false);
    });

    function applyEqualitySubstitutionBackwardsContinue(equalityFirst) {
      proveEqualityFirst = equalityFirst;
      let skolemConstants = getSkolemConstants(targetLine);
      equalityJustification = parseFormula(
          $("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      requestFormulaReplacedTerms(equalityJustification, "justificationNoJust",
          "substituteEqualityBackwardsCompleteNoJust");

      /*
       * Catch user action to complete the backwards equality substitution
         if no justification line has been selected
       */
      for (let i = 0; i < suggestedJustificationFormulas.length; i++) {
        $("#dynamicModalArea").off("click", "#justificationNoJust" + i);
        $("#dynamicModalArea").on("click", "#justificationNoJust" + i,
            function() {
          otherJustification = suggestedJustificationFormulas[i];
          applyEqualitySubstitutionBackwardsCompleteNoJust();
        });
      }
      $("#dynamicModalArea").off("click",
          "#substituteEqualityBackwardsCompleteNoJust");
      $("#dynamicModalArea").on("click",
          "#substituteEqualityBackwardsCompleteNoJust", function() {
        let skolemConstants = getSkolemConstants(targetLine);
        otherJustification = parseFormula(
            $("#additionalFormulaInput")[0].value,
            pithosData.proof.signature, skolemConstants);
        let anyReplacementValid = possibleReplacements
            .some(r =>
                matchFormulasTermsReplace(otherJustification, targetFormula, r));
        if (!anyReplacementValid) {
          let error = new ProofProcessingError("The entered formula cannot be "
              + "used as a justification for the selected target formula.")
          handleProofProcessingError(error);
          return;
        }
        applyEqualitySubstitutionBackwardsCompleteNoJust();
      });

      function applyEqualitySubstitutionBackwardsCompleteNoJust() {
        let newGoalLine1;
        let newGoalLine2;
        if (proveEqualityFirst) {
          newGoalLine1 = new JustifiedProofLine(equalityJustification,
              new SpecialJustification(justTypes.GOAL));
          newGoalLine2 = new JustifiedProofLine(otherJustification,
              new SpecialJustification(justTypes.GOAL));
        } else {
          newGoalLine1 = new JustifiedProofLine(otherJustification,
              new SpecialJustification(justTypes.GOAL));
          newGoalLine2 = new JustifiedProofLine(equalityJustification,
              new SpecialJustification(justTypes.GOAL));
        }
        targetLine.prepend(newGoalLine1);
        targetLine.prepend(new EmptyProofLine());
        targetLine.prepend(newGoalLine2);
        targetLine.justification
            = new Justification(justTypes.EQ_SUB,
                [newGoalLine1, newGoalLine2]);
        completeProofUpdate();
      }
    }

    /*
     * Catch user action to complete the backwards equality substitution
       if the formula with replaced terms has been selected as the
       only justification formula
     */
    $("#dynamicModalArea").off("click",
        "#substituteEqualityBackwardsCompleteJustForm1");
    $("#dynamicModalArea").on("click",
        "#substituteEqualityBackwardsCompleteJustForm1", function() {
      otherJustification = new Equality(replacementObject.replaced,
          replacementObject.replacement)
      applyEqualitySubstitutionBackwardsCompleteJust();
    });
    $("#dynamicModalArea").off("click",
        "#substituteEqualityBackwardsCompleteJustForm2");
    $("#dynamicModalArea").on("click",
        "#substituteEqualityBackwardsCompleteJustForm2", function() {
      otherJustification = new Equality(replacementObject.replacement,
          replacementObject.replaced)
      applyEqualitySubstitutionBackwardsCompleteJust();
    });

    /*
     * Catch user action to complete the backward equality substitution if an
       equality has been selected as the only justification formula
     */
    for (let i = 0; i < suggestedJustificationFormulas.length; i++) {
      $("#dynamicModalArea").off("click", "#justificationJustEq" + i);
      $("#dynamicModalArea").on("click", "#justificationJustEq" + i,
          function() {
        otherJustification = suggestedJustificationFormulas[i];
        applyEqualitySubstitutionBackwardsCompleteJust();
      });
    }
    $("#dynamicModalArea").off("click",
        "#substituteEqualityBackwardsCompleteJustEq");
    $("#dynamicModalArea").on("click",
        "#substituteEqualityBackwardsCompleteJustEq", function() {
      let skolemConstants = getSkolemConstants(targetLine);
      otherJustification = parseFormula(
          $("#additionalFormulaInput")[0].value,
          pithosData.proof.signature, skolemConstants);
      let anyReplacementValid = possibleReplacements
          .some(r =>
              matchFormulasTermsReplace(otherJustification, targetFormula, r));
      if (!anyReplacementValid) {
        let error = new ProofProcessingError("The entered formula cannot be "
            + "used as a justification for the selected target formula.")
        handleProofProcessingError(error);
        return;
      }
      applyEqualitySubstitutionBackwardsCompleteJust();
    });

    function applyEqualitySubstitutionBackwardsCompleteJust() {
      let newGoalLine = new JustifiedProofLine(otherJustification,
          new SpecialJustification(justTypes.GOAL));
      targetLine.prepend(newGoalLine);
      justificationLines.push(newGoalLine);
      targetLine.justification
          = new Justification(justTypes.EQ_SUB, justificationLines);
      let justification
          = new Justification(justTypes.EQ_SUB, justificationLines);
      completeProofUpdate();
    }
  }
}

/*
 * Function handling equality reflexivity application
 */
function applyEqualityReflexivity() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  if (targetLine instanceof EmptyProofLine) {
    /* Target line is an empty line - allow user to specify resulting formula */
    let modalBody = "<p>Please enter tha term that you would like to apply  "
         + "equality reflexivity to:</p>";
    modalBody +=
        `<input id="additionalTermInput0" class="additional-term-input form-control mb-2" type="text" placeholder="Please type your term here." value="" autocomplete="off">
        <div id="additionalTermParsed0" class="alert alert-dark" role="alert" style="word-wrap: break-word; ">
          The result of the parsing will appear here.
        </div>`;
    showModal("Input required", modalBody, undefined,
        "applyEqualityReflexivityComplete", undefined, true);
  } else {
    let targetFormula = targetLine.formula;
    if (targetFormula.type !== formulaTypes.EQUALITY) {
      throw new ProofProcessingError("The selected target formula is not an "
          + "equality.")
    }
    if (!formulasDeepEqual(targetFormula.term1, targetFormula.term2)) {
      throw new ProofProcessingError("The selected formula cannot be derived "
          + "using reflexivity.")
    }
    targetLine.justification
        = new SpecialJustification(justTypes.EQ_REFL);
    if (targetLine.prev instanceof EmptyProofLine) {
      targetLine.prev.delete();
    }
  }

  /*
   * Catch user action to complete the rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#applyEqualityReflexivityComplete");
  $("#dynamicModalArea").on("click", "#applyEqualityReflexivityComplete",
      function() {
    let skolemConstants = getSkolemConstants(targetLine);
    let term = parseSeparateTerm($("#additionalTermInput0")[0].value,
        pithosData.proof.signature, skolemConstants);
    let newFormula = new Equality(term, term);
    let justification
        = new SpecialJustification(justTypes.EQ_REFL);
    let newLine = new JustifiedProofLine(newFormula, justification);
    targetLine.prepend(newLine);
    completeProofUpdate();
  });
}

/*
 * Function handling equality symmetry application
 */
function applyEqualitySymmetry() {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let justificationLines = retrievedLines.justificationLines;
  let justificationFormula = justificationLines[0].formula;
  if (justificationFormula.type !== formulaTypes.EQUALITY) {
    throw new ProofProcessingError("The selected justification formula is not "
        + "an equality.")
  }
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  let newFormula = new Equality(justificationFormula.term2,
      justificationFormula.term1);
  if (targetLine instanceof EmptyProofLine) {
    let justification
        = new Justification(justTypes.EQ_SYM, justificationLines);
    let newLine = new JustifiedProofLine(newFormula, justification);
    targetLine.prepend(newLine);
  } else {
    let targetFormula = targetLine.formula;
    if (targetFormula.type !== formulaTypes.EQUALITY) {
      throw new ProofProcessingError("The selected target formula is not an "
          + "equality.")
    }
    if (!formulasDeepEqual(targetFormula, newFormula)) {
      throw new ProofProcessingError("The selected target formula cannot be "
          + "derived from the selected justification formula using equality "
          + "symmetry rule.")
    }
    targetLine.justification
        = new Justification(justTypes.EQ_SYM, justificationLines);
    if (targetLine.prev instanceof EmptyProofLine) {
      targetLine.prev.delete();
    }
  }
}

/*
 * Function handling universal introduction and universal implication
   introduction rules
 */
function addUniversal(isImplication) {
  let retrievedLines
      = retrieveLines(pithosData.proof, pithosData.selectedLinesSet);
  let targetLine = retrievedLines.targetLine;
  /* Used for dynamic parsing of additional formulas */
  pithosData.targetLine = targetLine;
  /* Declared variables for use by following code */
  let targetFormula;
  let newSkolemConstants = new Set([]);
  let universalCount;
  if (targetLine instanceof EmptyProofLine) {
    /* Target line is an empty line - allow user to specify resulting
       formula */
    let requestText = "Please enter the formula that you would like to "
        + `introduce using universal ${isImplication ? "implication " : ""}`
        + "introduction rule:";
    requestFormulaInput(requestText, "addUniversalContinue");
  } else {
    targetFormula = targetLine.formula;
    if (targetFormula.type !== formulaTypes.UNIVERSAL) {
      throw new ProofProcessingError("The selected target formula is "
          + "not a universal.");
    }
    addUniversalContinue();
  }

  /*
   * Catch user action to proceed with the rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#addUniversalContinue");
  $("#dynamicModalArea").on("click", "#addUniversalContinue",
      function() {
    let skolemConstants = getSkolemConstants(targetLine);
    targetFormula = parseFormula($("#additionalFormulaInput")[0].value,
        pithosData.proof.signature, skolemConstants);
    if (targetFormula.type !== formulaTypes.UNIVERSAL) {
      let error = new ProofProcessingError("The entered formula is not a "
          + "universal.");
      handleProofProcessingError(error);
      return;
    }
    addUniversalContinue();
  })

  function addUniversalContinue() {
    /* Prepare possibly useful modal body and count the number of universal
       quantifiers */
    let modalBody =
         "<p>Please choose the number of outer quantifiers that should be "
         + "introduced by this rule application in the formula"
         + `${targetFormula.stringRep}:</p>`;
    universalCount = 0;
    let currFormula;
    for (currFormula = targetFormula;
        currFormula.type === formulaTypes.UNIVERSAL;
        currFormula = currFormula.predicate) {
      modalBody +=
          `<div class="custom-control custom-radio">
             <input type="radio" id="universalRadio${universalCount}" class="custom-control-input">
             <label class="custom-control-label" for="universalRadio${universalCount}">${universalCount + 1}</label>
           </div>`
      universalCount++;
    }
    if (isImplication || universalCount === 1) {
      /* Automatically introduce all outer universal quantifiers */
      if (isImplication && currFormula.type !== formulaTypes.IMPLICATION) {
        let error = new ProofProcessingError("The introduced formula does "
            + "not contain an implication at the outermost level after "
            + "universal quantifiers.");
        handleProofProcessingError(error);
        return;
      }
      addUniversalComplete(universalCount);
    } else {
      /* Ask the user how many outer universal quantifiers should be
         introduced */
      showModal("Input required", modalBody, undefined,
          "addUniversalComplete");
    }
  }

  /*
   * Catch user action to complete the rule application
   */
  /* Unbind possible previously bound events */
  $("#dynamicModalArea").off("click", "#addUniversalComplete");
  $("#dynamicModalArea").on("click", "#addUniversalComplete",
      function() {
    let numberIntroduced = 0;
    for (let i = 0; i < universalCount; i++) {
      if ($("#universalRadio" + i).is(":checked")) {
        numberIntroduced = i + 1;
        break;
      }
    }
    if (numberIntroduced === 0) {
      numberIntroduced = universalCount;
    }
    addUniversalComplete(numberIntroduced);
  });

  function addUniversalComplete(numberIntroduced) {
    let replacements = {};
    let currFormula = targetFormula;
    for (let i = 0; i < numberIntroduced;
        i++) {
      replacements[currFormula.variableString]
          = new Constant(`sk${pithosData.proof.signature.skolemNext}`);
      newSkolemConstants.add(`sk${pithosData.proof.signature.skolemNext}`);
      pithosData.proof.signature.skolemNext++;
      currFormula = currFormula.predicate;
    }
    let constList = [];
    newSkolemConstants.forEach(sk => constList.push(sk));
    let initialLine = new JustifiedProofLine(new ConstantsList(constList),
        new SpecialJustification(justTypes.ALLI_CONST));
    let proofBox;
    let goalLine;
    let assumptionLine;
    let ruleJustificationLines;
    let justificationType;
    if (isImplication) {
      /* Performing universal implication introduction - add assumption in
         form of antecedent and only prove consequent */
      let antecedent = currFormula.operand1;
      let consequent = currFormula.operand2;
      let assumptionFormula = replaceVariables(antecedent, replacements);
      let goalFormula = replaceVariables(consequent, replacements);
      goalLine = new JustifiedProofLine(goalFormula,
          new SpecialJustification(justTypes.GOAL));
      proofBox = new ProofBox(initialLine, goalLine, false,
          newSkolemConstants);
      assumptionLine = new JustifiedProofLine(assumptionFormula,
          new SpecialJustification(justTypes.ASS));
      initialLine.append(assumptionLine);
      ruleJustificationLines = [initialLine, assumptionLine, goalLine];
      justificationType = justTypes.UNIV_IMP_INTRO;
    } else {
      /* Performning universal introduction */
      let goalFormula = replaceVariables(currFormula, replacements);
      goalLine = new JustifiedProofLine(goalFormula,
          new SpecialJustification(justTypes.GOAL));
      proofBox = new ProofBox(initialLine, goalLine, false,
          newSkolemConstants);
      ruleJustificationLines = [initialLine, goalLine];
      justificationType = justTypes.UNIV_INTRO;
    }
    if (targetLine instanceof EmptyProofLine) {
      /* Target line is an empty line - add new justified line */
      let newEmptyLine = new EmptyProofLine();
      targetLine.append(newEmptyLine);
      newEmptyLine.prepend(proofBox);
      let justification
           = new Justification(justificationType, ruleJustificationLines);
      let newJustifiedLine = new JustifiedProofLine(targetFormula,
          justification);
      newEmptyLine.prepend(newJustifiedLine);
    } else {
      /* Target line is a goal line - justify existing line */
      targetLine.prepend(proofBox);
      targetLine.justification
          = new Justification(justificationType, ruleJustificationLines);
    }
    completeProofUpdate();
  }
}

/*
 * Checks whether the the inputted formulas can be matched for the purposes
   of existential introduction and universal elimination (i.e. only terms
   have been replaced by variables or vice versa)
 * variablesSet contains textual representation of variables that are
   quantified and could be replaced by constants or vice versa
 * replacements dictionary stores pairs of variable names and corresponding
   terms (can be initially empty)
 */
function matchFormulasVariablesReplace(termsFormula, variablesFormula,
    variablesSet, replacements) {
  if (termsFormula.type !== variablesFormula.type
      && !(termsFormula instanceof Term && variablesFormula instanceof Term)) {
    return false;
  }
  if (termsFormula instanceof Term) {
    if (formulasDeepEqual(termsFormula, variablesFormula)) {
      /* Terms are identical - report match success */
      return true;
    }
    if (termsFormula.type === termTypes.VARIABLE) {
      /* termsFormula contains variable different from term in
         variablesFormula and hence the formulas do not match */
      return false;
    }
    if (termsFormula.type === termTypes.CONSTANT) {
      if (variablesFormula.type !== termTypes.VARIABLE
          || !variablesSet.has(variablesFormula.name)) {
        /* Constant does not correspond to a variable - formulas do not
           match */
        return false;
      }
      /* Constant corresponds with a variable - check whether the
         the replacement is consistent */
      if (!replacements.hasOwnProperty(variablesFormula.name)) {
        /* No previous replacement associated with the given variable
           has been logged - record the first */
        replacements[variablesFormula.name] = termsFormula;
        return true;
      }
      /* Replacement associated with the given variable has been logged -
         check whether the constants match */
      if (replacements[variablesFormula.name].type === termTypes.CONSTANT
          && formulasDeepEqual(replacements[variablesFormula.name],
              termsFormula)) {
        /* Successful match */
        return true;
      }
      /* Terms do not match - report failure */
      return false;
    }
    if (termsFormula.type === termTypes.FUNCTION) {
      if (variablesFormula.type === termTypes.CONSTANT) {
        /* Constant in variablesFormula formula cannot be matched to a
           function in the termsFormula formula */
        return false;
      }
      if (variablesFormula.type === termTypes.FUNCTION) {
        /* Check deep match - possible replacement must have
           occured inside function */
        if (termsFormula.name !== variablesFormula.name) {
          /* The names of functions do not match */
          return false;
        }
        return _.zipWith(termsFormula.terms, variablesFormula.terms,
            (t1, t2) => matchFormulasVariablesReplace(t1, t2,
                variablesSet, replacements))
            .reduce((b1, b2) => b1 && b2, true);
      }
      if (variablesFormula.type === termTypes.VARIABLE) {
        /* Function associated with a variable - check whether the replacement
           is valid */
        if (!variablesSet.has(variablesFormula.name)) {
          /* The encountered variable is not quantified - report failure */
          return false;
        }
        if (!replacements.hasOwnProperty(variablesFormula.name)) {
          /* No previous replacement associated with the given variable
             has been encountered - log the first */
          replacements[variablesFormula.name] = termsFormula;
          return true;
        }
        /* Replacement associated with a given variable has already occurred
           - check whether the corresponding functions match */
        if (replacements[variablesFormula.name].type === termTypes.FUNCTION
            && formulasDeepEqual(replacements[variablesFormula.name],
                termsFormula)) {
          /* Successful match */
          return true;
        }
        /* Terms do not match - report failure */
        return false;
      }
    }
  } else if (termsFormula instanceof Quantifier) {
    if (termsFormula.variableString !== variablesFormula.variableString) {
      return false;
    }
    if (variablesSet.has(termsFormula.variableString)) {
      /* Cannot match replacements associated with a variable that is
         already quantified at "deeper" level in the terms sub-formula */
      variablesSet.delete(termsFormula.variableString);
    }
    return matchFormulasVariablesReplace(termsFormula.predicate,
        variablesFormula.predicate, variablesSet, replacements);
  } else if (termsFormula.type === formulaTypes.RELATION) {
    if (termsFormula.name !== variablesFormula.name) {
      return false;
    }
    return _.zipWith(termsFormula.terms, variablesFormula.terms,
        (t1, t2) => matchFormulasVariablesReplace(t1, t2,
            variablesSet, replacements))
        .reduce((b1, b2) => b1 && b2, true);
  } else if (termsFormula instanceof Equality) {
    return matchFormulasVariablesReplace(termsFormula.term1,
            variablesFormula.term1, variablesSet, replacements)
        && matchFormulasVariablesReplace(termsFormula.term2,
            variablesFormula.term2, variablesSet, replacements);
  } else if (termsFormula.type === formulaTypes.NEGATION) {
    return matchFormulasVariablesReplace(termsFormula.operand,
        variablesFormula.operand, variablesSet, replacements);
  } else if (termsFormula instanceof BinaryConnective) {
    if (termsFormula.isAssociative) {
      let operandsTermsFormula = [];
      extractOperands(termsFormula, operandsTermsFormula,
          termsFormula.type);
      let operandsVariablesFormula = [];
      extractOperands(variablesFormula, operandsVariablesFormula,
          termsFormula.type);
      return _.zipWith(operandsTermsFormula, operandsVariablesFormula,
          (f1, f2) => matchFormulasVariablesReplace(f1, f2, variablesSet,
              replacements))
          .reduce((b1, b2) => b1 && b2, true);
    } else {
      return matchFormulasVariablesReplace(termsFormula.operand1,
              variablesFormula.operand1, variablesSet, replacements)
          && matchFormulasVariablesReplace(termsFormula.operand2,
              variablesFormula.operand2, variablesSet, replacements);
    }
  } else {
    return formulasDeepEqual(termsFormula, variablesFormula);
  }
}
