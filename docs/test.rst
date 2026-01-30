==================
reStructuredText Test
==================

This is a test document to verify RST rendering in MarkdownPlus.

Section 1: Basic Text
---------------------

This is a paragraph with **bold text**, *italic text*, and ``inline code``.

Here's another paragraph with a `link to Google <https://google.com>`_.

Section 2: Lists
----------------

Bullet List
~~~~~~~~~~~

- First item
- Second item with more text that continues
- Third item

Numbered List
~~~~~~~~~~~~~

1. First numbered item
2. Second numbered item
3. Third numbered item

Section 3: Code Blocks
----------------------

Here is a Python code block:

.. code-block:: python

    def hello_world():
        print("Hello, World!")
        return 42

    if __name__ == "__main__":
        hello_world()

Here is a literal block::

    This is a literal block.
    It preserves whitespace and formatting.
        Indentation is preserved too.

Section 4: Mermaid Diagrams
---------------------------

Here's a flowchart diagram:

.. code-block:: mermaid

    graph TD
        A[Start] --> B{Is it working?}
        B -->|Yes| C[Great!]
        B -->|No| D[Debug]
        D --> B

Here's a sequence diagram:

.. code-block:: mermaid

    sequenceDiagram
        participant User
        participant App
        participant Server
        User->>App: Open RST file
        App->>Server: Request rendering
        Server-->>App: Return HTML
        App-->>User: Display preview

Section 5: Block Quotes
-----------------------

Here is a block quote:

    "The only way to do great work is to love what you do."
    -- Steve Jobs

Section 6: Definition Lists
---------------------------

Term 1
    Definition for term 1 which can span
    multiple lines.

Term 2
    Definition for term 2.

Section 7: Admonitions
----------------------

.. note:: This is a note admonition. It provides additional information.

.. warning:: This is a warning admonition. Be careful!

.. tip:: This is a helpful tip for users.

Section 8: Images
-----------------

.. image:: https://via.placeholder.com/150

Conclusion
----------

This document demonstrates the RST rendering capabilities of MarkdownPlus, including support for mermaid diagrams.
