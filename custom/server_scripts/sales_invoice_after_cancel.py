if doc.expense_journal_entry is not None:
    je = frappe.get_doc("Journal Entry", doc.expense_journal_entry)
    je.cancel()